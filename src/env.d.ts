/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GITHUB_USERNAME: string;
  readonly PUBLIC_FORMSPREE_ID?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly GITHUB_TOKEN?: string;
  readonly PERSONAL_GITHUB_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
