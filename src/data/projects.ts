/**
 * Curated projects — Oracle OSS + personal labs highlighted on the site.
 * Live public repos are also merged from GitHub API (saurabhahuja71) at build time.
 */
export interface Project {
  name: string;
  description: string;
  url?: string;
  homepage?: string;
  stars?: number;
  forks?: number;
  language?: string;
  topics?: string[];
  image?: string;
  featured?: boolean;
  source: 'curated' | 'github';
  updatedAt?: string;
}

export const curatedProjects: Project[] = [
  {
    name: 'Oracle Database Operator',
    description:
      'Kubernetes operator for Oracle Database — lifecycle management on cloud-native platforms. Available on OperatorHub.',
    url: 'https://github.com/oracle/oracle-database-operator',
    homepage: 'https://operatorhub.io/operator/oracle-database-operator',
    language: 'Go',
    topics: ['kubernetes', 'operators', 'oracle-database', 'go'],
    image: '/images/projects/k8s-operator.svg',
    featured: true,
    source: 'curated',
  },
  {
    name: 'oracle-rac-k8s-operator-lab',
    description:
      'Companion manifests and pre-flight scripts for provisioning Oracle RAC with Oracle Database Operator on Kubernetes (blog lab).',
    url: 'https://github.com/saurabhahuja71/oracle-rac-k8s-operator-lab',
    homepage:
      'https://onenova.in/blog/provision-oracle-rac-database-kubernetes-operator/',
    language: 'Shell',
    topics: ['oracle-rac', 'kubernetes', 'operators', 'asm'],
    image: '/images/projects/k8s-operator.svg',
    featured: true,
    source: 'curated',
  },
  {
    name: 'oracle/docker-images',
    description:
      'Official Oracle Docker images — Database, Instant Client, and related container build patterns.',
    url: 'https://github.com/oracle/docker-images',
    language: 'Shell',
    topics: ['docker', 'oracle', 'containers'],
    image: '/images/projects/oci-terraform.svg',
    featured: true,
    source: 'curated',
  },
  {
    name: 'oracle/db-sharding',
    description: 'Oracle Database Sharding reference implementations and samples.',
    url: 'https://github.com/oracle/db-sharding',
    language: 'Shell',
    topics: ['oracle-database', 'sharding'],
    image: '/images/projects/default.svg',
    featured: true,
    source: 'curated',
  },
  {
    name: 'learning-path',
    description:
      'Curated hands-on labs for students and new engineers — Go, Python, Java/Helidon, Kubernetes, Terraform, CI/CD, AI/MCP.',
    url: 'https://github.com/saurabhahuja71/learning-path',
    homepage: 'https://onenova.in/learning-path',
    language: 'Markdown',
    topics: ['education', 'labs', 'kubernetes', 'go', 'python'],
    image: '/images/projects/portfolio.svg',
    featured: true,
    source: 'curated',
  },
  {
    name: 'saurabhahuja71.github.io',
    description: 'Public engineering profile — about, focus areas, OSS, and publications.',
    url: 'https://github.com/saurabhahuja71/saurabhahuja71.github.io',
    homepage: 'https://saurabhahuja71.github.io',
    language: 'Markdown',
    topics: ['profile', 'portfolio'],
    image: '/images/projects/portfolio.svg',
    featured: true,
    source: 'curated',
  },
  {
    name: 'OneNova Portfolio',
    description:
      'This site — static Astro portfolio at onenova.in with self-hosted GitHub Actions deploy on GCP.',
    url: 'https://github.com/saurabhahuja71',
    homepage: 'https://onenova.in',
    language: 'TypeScript',
    topics: ['astro', 'tailwind', 'portfolio', 'github-actions'],
    image: '/images/projects/portfolio.svg',
    featured: true,
    source: 'curated',
  },
];
