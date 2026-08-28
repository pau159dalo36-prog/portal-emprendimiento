// Tipos de la búsqueda. Cada entidad tiene SU propio resultado de RPC con todo
// lo necesario para renderizar (autor, proyecto/organización, miniaturas) en UN
// solo viaje: NO hay N+1. El score NO viaja a la UI (es interno: cursor,
// auditoría y tests) al igual que en el feed; este tipo lo garantiza.

export type SearchAuthorRef = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type SearchProjectRef = {
  id: string;
  name: string;
  slug: string;
};

export type SearchOrganizationRef = {
  id: string;
  name: string;
  slug: string;
};

export type SearchProfile = {
  id: string;
  fullName: string | null;
  username: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  userTypes: string[];
  isFollowing: boolean;
  createdAt: string;
};

export type SearchProject = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  slug: string;
  coverImageUrl: string | null;
  stage: string;
  industries: string[];
  owner: SearchAuthorRef | null;
  organization: SearchOrganizationRef | null;
  createdAt: string;
};

export type SearchOrganization = {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  slug: string;
  logoUrl: string | null;
  location: string | null;
  industries: string[];
  owner: SearchAuthorRef | null;
  createdAt: string;
};

export type SearchVideo = {
  id: string;
  title: string;
  caption: string | null;
  thumbnailPath: string | null;
  thumbnailBucket: string | null;
  posterPath: string | null;
  posterBucket: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  owner: SearchAuthorRef | null;
  project: SearchProjectRef | null;
  organization: SearchOrganizationRef | null;
  createdAt: string;
};

export type SearchProfileResult = {
  id: string;
  fullName: string | null;
  username: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  userTypes: string[];
  isFollowing: boolean;
  score: number;
  createdAt: string;
};

export type SearchProjectResult = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  slug: string;
  coverImageUrl: string | null;
  stage: string;
  industries: string[];
  ownerId: string;
  ownerFullName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  score: number;
  createdAt: string;
};

export type SearchOrganizationResult = {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  slug: string;
  logoUrl: string | null;
  location: string | null;
  industries: string[];
  ownerId: string;
  ownerFullName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  score: number;
  createdAt: string;
};

export type SearchOpportunity = {
  id: string;
  title: string;
  description: string | null;
  opportunityType: string;
  employmentType: string | null;
  experienceLevel: string | null;
  workMode: string | null;
  industry: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  locationText: string | null;
  compensationType: string | null;
  compensationMin: number | null;
  compensationMax: number | null;
  currency: string | null;
  compensationPeriod: string | null;
  startsAt: string | null;
  endsAt: string | null;
  slotsTotal: number | null;
  isFirstJobFriendly: boolean;
  isStudentFriendly: boolean;
  owner: SearchAuthorRef | null;
  project: SearchProjectRef | null;
  organization: SearchOrganizationRef | null;
  createdAt: string;
};

export type SearchOpportunityResult = {
  id: string;
  title: string;
  description: string | null;
  opportunityType: string;
  employmentType: string | null;
  experienceLevel: string | null;
  workMode: string | null;
  industry: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  locationText: string | null;
  compensationType: string | null;
  compensationMin: number | null;
  compensationMax: number | null;
  currency: string | null;
  compensationPeriod: string | null;
  startsAt: string | null;
  endsAt: string | null;
  slotsTotal: number | null;
  isFirstJobFriendly: boolean;
  isStudentFriendly: boolean;
  projectId: string | null;
  projectName: string | null;
  projectSlug: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  ownerId: string;
  ownerFullName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  score: number;
  createdAt: string;
};

export type SearchVideoResult = {
  id: string;
  title: string;
  caption: string | null;
  thumbnailPath: string | null;
  thumbnailBucket: string | null;
  posterPath: string | null;
  posterBucket: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  ownerId: string;
  ownerFullName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  projectId: string | null;
  projectName: string | null;
  projectSlug: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  score: number;
  createdAt: string;
};

// Servicios (FASE 7): el proveedor es un perfil; headline viaja para las
// tarjetas de descubrimiento sin segundo viaje.
export type SearchService = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  deliveryMode: string;
  pricingType: string;
  priceAmount: number | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  provider: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    headline: string | null;
  } | null;
  createdAt: string;
};

export type SearchServiceResult = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  deliveryMode: string;
  pricingType: string;
  priceAmount: number | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  providerId: string;
  providerFullName: string | null;
  providerUsername: string | null;
  providerAvatarUrl: string | null;
  providerHeadline: string | null;
  score: number;
  createdAt: string;
};

// Cursor opaco para la UI: la capa de datos lo serializa/deserializa.
export type SearchCursor = {
  score: number;
  createdAt: string;
  id: string;
};

export type SearchPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type SearchPageResult<T> =
  | { ok: true; page: SearchPage<T> }
  | { ok: false; error: string };
