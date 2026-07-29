export interface Skill {
  name: string;
  category: 'languages' | 'platform' | 'data' | 'observability' | 'cloud' | 'frontend' | 'ai';
  /** SimpleCSS / emoji / short label used as icon fallback */
  icon: string;
  /** Brand color for accent */
  color: string;
  level?: 'expert' | 'advanced' | 'proficient';
  description?: string;
}

export const skills: Skill[] = [
  { name: 'Go', category: 'languages', icon: 'Go', color: '#00ADD8', level: 'expert', description: 'Infrastructure tooling & operators' },
  { name: 'Python', category: 'languages', icon: 'Py', color: '#3776AB', level: 'advanced' },
  { name: 'Shell', category: 'languages', icon: 'Sh', color: '#4EAA25', level: 'expert' },
  { name: 'Java', category: 'languages', icon: 'Jv', color: '#b07219', level: 'advanced' },
  { name: 'TypeScript', category: 'languages', icon: 'TS', color: '#3178C6', level: 'proficient' },
  { name: 'Kubernetes', category: 'platform', icon: 'K8s', color: '#326CE5', level: 'expert', description: 'Operators, control planes' },
  { name: 'Docker', category: 'platform', icon: 'Dk', color: '#2496ED', level: 'expert' },
  { name: 'Podman', category: 'platform', icon: 'Pd', color: '#892CA0', level: 'advanced' },
  { name: 'Linux', category: 'platform', icon: 'Lx', color: '#FCC624', level: 'expert', description: 'Oracle Linux, RHEL, Ubuntu' },
  { name: 'Ansible', category: 'platform', icon: 'An', color: '#EE0000', level: 'advanced' },
  { name: 'GitHub Actions', category: 'platform', icon: 'GHA', color: '#2088FF', level: 'advanced' },
  { name: 'Terraform', category: 'cloud', icon: 'Tf', color: '#7B42BC', level: 'advanced' },
  { name: 'OCI', category: 'cloud', icon: 'OCI', color: '#F80000', level: 'expert', description: 'Oracle Cloud Infrastructure' },
  { name: 'AWS', category: 'cloud', icon: 'AWS', color: '#FF9900', level: 'proficient' },
  { name: 'Oracle Database', category: 'data', icon: 'Ora', color: '#F80000', level: 'expert', description: 'RAC, 23ai, Sharding' },
  { name: 'MySQL', category: 'data', icon: 'My', color: '#4479A1', level: 'advanced' },
  { name: 'Redis', category: 'data', icon: 'Rd', color: '#DC382D', level: 'advanced' },
  { name: 'PostgreSQL', category: 'data', icon: 'PG', color: '#4169E1', level: 'proficient' },
  { name: 'Prometheus', category: 'observability', icon: 'Prom', color: '#E6522C', level: 'advanced' },
  { name: 'Grafana', category: 'observability', icon: 'Grf', color: '#F46800', level: 'advanced' },
  { name: 'Astro', category: 'frontend', icon: 'As', color: '#FF5D01', level: 'proficient' },
  { name: 'Tailwind CSS', category: 'frontend', icon: 'Tw', color: '#06B6D4', level: 'proficient' },
  { name: 'AI / LLMs', category: 'ai', icon: 'AI', color: '#10B981', level: 'proficient', description: 'Agents, MCP, RAG' },
];

export const skillCategories: Record<Skill['category'], string> = {
  languages: 'Languages',
  platform: 'Platform & DevOps',
  cloud: 'Cloud & IaC',
  data: 'Data Stores',
  observability: 'Observability',
  frontend: 'Web',
  ai: 'AI',
};
