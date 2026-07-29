export interface Certification {
  title: string;
  issuer: string;
  date: string;
  credentialId?: string;
  url?: string;
  description?: string;
  badge?: string;
}

export interface Achievement {
  title: string;
  date: string;
  description: string;
  org?: string;
}

/** Product docs & technical publications (from GitHub profile). */
export const publications: Certification[] = [
  {
    title: 'Oracle Real Application Clusters Installation Guide – Podman / Oracle Linux',
    issuer: 'Oracle Database documentation',
    date: 'Official',
    description: 'Official RAC installation guidance for Podman on Oracle Linux.',
    url: 'https://docs.oracle.com/en/database/oracle/oracle-database/26/racpd/oracle-real-application-clusters-installation-guide-podman-oracle-linux.pdf',
  },
  {
    title: 'Installing and Configuring Oracle RAC on OLCNE',
    issuer: 'Oracle Database 19c documentation',
    date: 'Official',
    description: 'RAC on Oracle Linux Cloud Native Environment.',
    url: 'https://docs.oracle.com/en/database/oracle/oracle-database/19/rackb/install-configure-rac-olcne.html',
  },
  {
    title: 'Deploying OKE on Compute Cloud @ Customer / PCA',
    issuer: 'Oracle Cloud Infrastructure whitepaper',
    date: 'Official',
    description: 'Technical whitepaper on deploying Oracle Kubernetes Engine on C@C / PCA.',
    url: 'https://www.oracle.com/a/ocom/docs/cloud/deploying-oke-on-compute-cloud@customer-or-pca.pdf',
  },
];

export const certifications: Certification[] = [
  ...publications,
];

export const achievements: Achievement[] = [
  {
    title: 'Oracle open source contributor',
    date: 'Ongoing',
    org: 'Oracle',
    description:
      'Active work on oracle-database-operator, docker-images, and related database/container OSS.',
  },
  {
    title: 'Learning path for students',
    date: 'Ongoing',
    description:
      'Maintains a multi-track lab hub (Go, Python, Java, K8s, Terraform, CI/CD, AI) for college students and early-career engineers.',
  },
  {
    title: 'Product documentation',
    date: 'Ongoing',
    org: 'Oracle',
    description:
      'Contributions to RAC, Podman, OLCNE, and OKE architecture documentation and whitepapers.',
  },
];
