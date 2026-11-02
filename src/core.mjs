/** Pure, testable rules for GitHub Boss Rush. Public GitHub metrics are game flavor, not skill rankings. */
export const REPO_URL = 'https://github.com/Berserk-hub150/GITHUB-BOSS-RUSH';
export const BASE_DEMO = {
  hero: { login: 'Berserk-hub150', name: 'THE BUILDER', followers: 3965, public_repos: 31, stars: 222, featured: 'AI Skill Navigator', demo: true },
  boss: { login: 'torvalds', name: 'THE KERNEL', followers: 250000, public_repos: 8, stars: 150000, featured: 'linux', demo: true }
};
export function validLogin(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 39 && /^(?!-)[a-z\d]+(?:-+[a-z\d]+)*$/i.test(value);
}
export function cleanLogin(value, fallback = '') {
  const trimmed = String(value ?? '').trim().replace(/^@/, '');
  return validLogin(trimmed) ? trimmed : fallback;
}
export function normalizeProfile(user, repos = []) {
  if (!user || !validLogin(user.login)) throw new Error('Invalid GitHub profile');
  const sorted = [...repos].filter(r => !r.fork).sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
  const top = sorted[0];
  return {
    login: user.login,
    name: String(user.name || user.login).slice(0, 40),
    followers: Number(user.followers) || 0,
    public_repos: Number(user.public_repos) || 0,
    stars: sorted.reduce((acc, r) => acc + (Number(r.stargazers_count) || 0), 0),
    featured: top?.name || 'OPEN SOURCE',
    demo: false,
    sampled: repos.length,
    avatar_url: user.avatar_url || ''
  };
}
export function statsFor(profile) {
  // Logarithmic compression avoids making popular accounts unbeatable.
  const followers = Math.max(0, profile.followers || 0);
  const repos = Math.max(0, profile.public_repos || 0);
  const stars = Math.max(0, profile.stars || 0);
  return {
    power: Math.round(35 + Math.min(27, Math.log10(followers + 1) * 6) + Math.min(22, Math.log10(stars + 1) * 5) + Math.min(15, Math.log10(repos + 1) * 7)),
    speed: Math.min(9, 3 + Math.floor(Math.log10(repos + 1) * 2)),
    guard: Math.min(9, 2 + Math.floor(Math.log10(followers + 1) * 1.5)),
    attack: Math.min(9, 2 + Math.floor(Math.log10(stars + 1) * 1.6)),
  };
}
export function shareUrl(hero, boss, base = globalThis.location?.href || 'https://example.org/') {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('hero', cleanLogin(hero, 'Berserk-hub150'));
  url.searchParams.set('boss', cleanLogin(boss, 'torvalds'));
  return url.toString();
}
export function timeLabel(seconds) { return String(Math.max(0, Math.ceil(seconds))).padStart(2, '0'); }
export function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }
