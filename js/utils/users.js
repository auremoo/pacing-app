// Utilisateurs de l'app et session.
//
// Une seule app, un seul dépôt, un dossier de données par personne. config.json
// liste les utilisateurs, chacun avec le PAT chiffré par SON mot de passe :
// c'est le mot de passe tapé à la connexion qui désigne l'utilisateur, il n'y a
// pas d'écran « qui êtes-vous ». AES-GCM refuse de déchiffrer avec la mauvaise
// clé, donc essayer chaque entrée est sans ambiguïté.
//
// Format historique (un seul utilisateur, données à la racine) :
//   { owner, repo, branch, encryptedToken }
// Format multi-utilisateur :
//   { owner, repo, branch, encryptedToken, users: [{ name, dataPath, encryptedToken }] }
// encryptedToken au premier niveau est conservé pour le premier utilisateur.

import { decryptToken, encryptToken } from './crypto.js';

const SESSION_KEY = 'pacing_auth';
const PAT_KEY     = 'pacing_pat';
const DATA_KEY    = 'pacing_data_path';
const NAME_KEY    = 'pacing_user';

export function listUsers(cfg) {
  if (Array.isArray(cfg?.users) && cfg.users.length) return cfg.users;
  return cfg?.encryptedToken ? [{ name: null, dataPath: '', encryptedToken: cfg.encryptedToken }] : [];
}

// → { token, user } ou null si aucun utilisateur n'accepte ce mot de passe
export async function findUserByPassword(cfg, password) {
  for (const user of listUsers(cfg)) {
    try {
      const token = await decryptToken(user.encryptedToken, password);
      return { token, user };
    } catch { /* pas cet utilisateur */ }
  }
  return null;
}

// ── Session (sessionStorage, le temps que l'app reste ouverte) ────────

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === '1' && !!sessionStorage.getItem(PAT_KEY);
}

export function saveSession(token, user) {
  sessionStorage.setItem(PAT_KEY, token);
  sessionStorage.setItem(DATA_KEY, user.dataPath || '');
  sessionStorage.setItem(NAME_KEY, user.name || '');
  sessionStorage.setItem(SESSION_KEY, '1');
}

export function getSession() {
  return {
    token:    sessionStorage.getItem(PAT_KEY),
    dataPath: sessionStorage.getItem(DATA_KEY) || '',
    name:     sessionStorage.getItem(NAME_KEY) || '',
  };
}

export function clearSession() {
  [SESSION_KEY, PAT_KEY, DATA_KEY, NAME_KEY].forEach(k => sessionStorage.removeItem(k));
}

// ── Ajout d'un utilisateur ────────────────────────────────────────────

export function slugifyName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'utilisateur';
}

// Construit la nouvelle config sans rien écrire : l'appelant s'occupe des
// fichiers. currentName ne sert qu'à nommer le premier utilisateur quand la
// config est encore au format historique.
// Passe une config historique (un seul encryptedToken) au format liste, en
// nommant le premier utilisateur. Sans effet sur une config déjà en liste.
function withNamedUsers(cfg, currentName) {
  const users = listUsers(cfg).map(u => ({ ...u }));
  if (users.length === 1 && !users[0].name) users[0].name = currentName || 'Utilisateur 1';
  return { ...cfg, users };
}

export async function buildConfigWithUser(cfg, { name, password, token, currentName }) {
  if (await findUserByPassword(cfg, password)) {
    throw new Error('Ce mot de passe est déjà utilisé par un autre utilisateur.');
  }
  // Le code d'invitation est connu de toutes les personnes invitées : s'en
  // servir comme mot de passe leur ouvrirait ce compte.
  if (await tokenFromInvite(cfg, password)) {
    throw new Error('Ton mot de passe doit être différent du code d\'invitation.');
  }

  const { users } = withNamedUsers(cfg, currentName);

  if (users.some(u => (u.name || '').toLowerCase() === name.toLowerCase())) {
    throw new Error(`Il existe déjà un utilisateur « ${name} ».`);
  }

  let dataPath = `users/${slugifyName(name)}`;
  for (let i = 2; users.some(u => u.dataPath === dataPath); i++) dataPath = `users/${slugifyName(name)}-${i}`;

  const user = { name, dataPath, encryptedToken: await encryptToken(token, password) };
  return { config: { ...cfg, users: [...users, user] }, user };
}

// ── Code d'invitation ─────────────────────────────────────────────────
// Créer un compte depuis l'écran de connexion demande d'écrire dans le dépôt,
// donc le token, alors que personne n'est connecté. Une inscription libre
// rendrait ce token récupérable par quiconque visite l'URL publique — avec les
// droits d'écriture sur le dépôt, donc sur le code même de l'app publiée par
// GitHub Pages. Le token est donc aussi chiffré par un code d'invitation que
// l'on communique aux personnes à inviter, et qu'on peut changer ou retirer.
// Format : config.invite = { encryptedToken, createdAt }

export function hasInvite(cfg) {
  return !!cfg?.invite?.encryptedToken;
}

export async function tokenFromInvite(cfg, code) {
  if (!hasInvite(cfg) || !code) return null;
  try { return await decryptToken(cfg.invite.encryptedToken, code); }
  catch { return null; }
}

// code null ou vide : retire l'invitation (plus d'inscription possible)
export async function buildConfigWithInvite(cfg, { code, token, currentName }) {
  const config = withNamedUsers(cfg, currentName);
  if (!code) {
    const { invite, ...rest } = config;
    return rest;
  }
  if (await findUserByPassword(cfg, code)) {
    throw new Error('Ce code est le mot de passe d\'un utilisateur : choisis-en un autre, sinon les personnes invitées pourraient se connecter à ce compte.');
  }
  return { ...config, invite: { encryptedToken: await encryptToken(token, code), createdAt: new Date().toISOString() } };
}
