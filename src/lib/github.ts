import { curatedProjects, type Project } from '@data/projects';
import { siteConfig } from '@data/site';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GITHUB_API = 'https://api.github.com';

export interface GitHubUserStats {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  updated_at: string;
}

function env(name: string): string | undefined {
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.[name] : undefined;
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  return fromProcess || fromMeta || undefined;
}

function authHeaders(): string[] {
  const headers = [
    'Accept: application/vnd.github+json',
    'User-Agent: onenova-portfolio-build',
    'X-GitHub-Api-Version: 2022-11-28',
  ];
  const token = env('PERSONAL_GITHUB_TOKEN') || env('GITHUB_TOKEN');
  if (token) headers.push(`Authorization: Bearer ${token}`);
  return headers;
}

export function getGitHubUsername(): string {
  return env('PUBLIC_GITHUB_USERNAME') || siteConfig.social.githubUser;
}

/**
 * Build-time HTTP via curl so corporate proxies (HTTP_PROXY/HTTPS_PROXY) work.
 * Falls back to native fetch when curl is unavailable.
 */
async function ghFetch<T>(path: string, init?: { method?: string; body?: string }): Promise<T | null> {
  const url = `${GITHUB_API}${path}`;
  const proxy =
    env('HTTPS_PROXY') ||
    env('https_proxy') ||
    env('HTTP_PROXY') ||
    env('http_proxy');

  try {
    const args = ['-sS', '-f', '--max-time', '30', '-L'];
    if (proxy) {
      args.push('-x', proxy);
      // Corporate MITM proxies often need insecure TLS
      if (env('NODE_TLS_REJECT_UNAUTHORIZED') === '0') {
        args.push('-k');
      }
    }
    for (const h of authHeaders()) {
      args.push('-H', h);
    }
    if (init?.method === 'POST') {
      args.push('-X', 'POST', '-H', 'Content-Type: application/json');
      if (init.body) args.push('--data-binary', init.body);
    }
    args.push(url);

    const { stdout } = await execFileAsync('curl', args, {
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    return JSON.parse(stdout) as T;
  } catch (curlErr) {
    // Fallback: native fetch (works without proxy)
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'onenova-portfolio-build',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const token = env('PERSONAL_GITHUB_TOKEN') || env('GITHUB_TOKEN');
      if (token) headers.Authorization = `Bearer ${token}`;
      if (init?.method === 'POST') headers['Content-Type'] = 'application/json';

      const res = await fetch(url, {
        method: init?.method || 'GET',
        headers,
        body: init?.body,
      });
      if (!res.ok) {
        console.warn(`[github] ${path} → ${res.status} ${res.statusText}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      console.warn(`[github] fetch failed for ${path}:`, curlErr || err);
      return null;
    }
  }
}

export async function fetchGitHubUser(): Promise<GitHubUserStats | null> {
  const user = getGitHubUsername();
  const data = await ghFetch<{
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
    bio: string | null;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
  }>(`/users/${user}`);

  if (!data) return null;

  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
    bio: data.bio,
    publicRepos: data.public_repos,
    followers: data.followers,
    following: data.following,
    createdAt: data.created_at,
  };
}

export async function fetchGitHubRepos(limit = 12): Promise<Project[]> {
  const user = getGitHubUsername();
  const repos = await ghFetch<GitHubRepo[]>(
    `/users/${user}/repos?sort=updated&per_page=50&type=owner`,
  );

  if (!repos || repos.length === 0) {
    return curatedProjects;
  }

  const filtered = repos
    .filter((r) => !r.fork && !r.archived)
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
    })
    .slice(0, limit)
    .map(
      (r): Project => ({
        name: r.name,
        description: r.description || 'No description provided.',
        url: r.html_url,
        homepage: r.homepage || undefined,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language || undefined,
        topics: r.topics || [],
        image: `https://opengraph.githubassets.com/1/${r.full_name}`,
        featured: r.stargazers_count > 0 || (r.topics?.length ?? 0) > 0,
        source: 'github',
        updatedAt: r.pushed_at,
      }),
    );

  const names = new Set(filtered.map((p) => p.name.toLowerCase()));
  const extras = curatedProjects.filter((p) => !names.has(p.name.toLowerCase()));

  return [...extras.filter((p) => p.featured), ...filtered].slice(0, limit + extras.length);
}

export interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ContributionWeek {
  days: ContributionDay[];
}

export interface ContributionData {
  totalContributions: number;
  weeks: ContributionWeek[];
}

export async function fetchContributionGraph(): Promise<ContributionData | null> {
  const token = env('PERSONAL_GITHUB_TOKEN') || env('GITHUB_TOKEN');

  if (!token) {
    return null;
  }

  const user = getGitHubUsername();
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  try {
    const json = await ghFetch<{
      data?: {
        user?: {
          contributionsCollection?: {
            contributionCalendar?: {
              totalContributions: number;
              weeks: Array<{
                contributionDays: Array<{
                  date: string;
                  contributionCount: number;
                  contributionLevel: string;
                }>;
              }>;
            };
          };
        };
      };
    }>('/graphql', {
      method: 'POST',
      body: JSON.stringify({ query, variables: { login: user } }),
    });

    const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) return null;

    const levelMap: Record<string, 0 | 1 | 2 | 3 | 4> = {
      NONE: 0,
      FIRST_QUARTILE: 1,
      SECOND_QUARTILE: 2,
      THIRD_QUARTILE: 3,
      FOURTH_QUARTILE: 4,
    };

    return {
      totalContributions: cal.totalContributions,
      weeks: cal.weeks.map((w) => ({
        days: w.contributionDays.map((d) => ({
          date: d.date,
          count: d.contributionCount,
          level: levelMap[d.contributionLevel] ?? 0,
        })),
      })),
    };
  } catch (err) {
    console.warn('[github] contribution graph failed:', err);
    return null;
  }
}

export const languageColors: Record<string, string> = {
  Go: '#00ADD8',
  TypeScript: '#3178C6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  HCL: '#844FBA',
  Shell: '#89e051',
  Dockerfile: '#384d54',
  YAML: '#cb171e',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  Astro: '#ff5a03',
};
