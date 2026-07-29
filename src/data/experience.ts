export interface ExperienceItem {
  company: string;
  role: string;
  location?: string;
  start: string;
  end: string;
  current?: boolean;
  summary: string;
  highlights: string[];
  tech: string[];
  url?: string;
}

export const experience: ExperienceItem[] = [
  {
    company: 'Oracle',
    role: 'Principal Member of Technical Staff',
    location: 'Bangalore, India',
    start: '—',
    end: 'Present',
    current: true,
    summary:
      'RACPACK MAA Solution Engineering — designing and operating reliable infrastructure for Oracle Database on public cloud, private cloud, and on-prem, with a focus on Kubernetes operators, containers, and lifecycle automation.',
    highlights: [
      'Kubernetes operator and automation design for Oracle Database lifecycle management.',
      'Contributions to Oracle open source: oracle-database-operator, docker-images, db-sharding.',
      'Cloud infrastructure patterns on OCI and Oracle Linux container platforms (OLCNE, OKE, Podman).',
      'Official product documentation and architecture whitepapers for RAC, Podman, and OKE deployments.',
      'Reliability, observability, and reducing operational / lifecycle risk for database platforms.',
    ],
    tech: [
      'Kubernetes',
      'Go',
      'Oracle Database',
      'OCI',
      'Docker',
      'Podman',
      'Terraform',
      'Oracle Linux',
      'Prometheus',
    ],
    url: 'https://www.oracle.com',
  },
];

export interface EducationItem {
  school: string;
  degree: string;
  field: string;
  start: string;
  end: string;
  details?: string;
}

export const education: EducationItem[] = [
  {
    school: 'Punjab Engineering College (PEC), Chandigarh',
    degree: 'B.E.',
    field: 'Information Technology',
    start: '2005',
    end: '2009',
    details: 'Bachelor of Engineering in Information Technology.',
  },
];
