import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { matchPath } from 'react-router-dom';

type RouteComponent = LazyExoticComponent<ComponentType>;

export interface AppRouteDefinition {
  path: string;
  component: RouteComponent;
}

const Dashboard = lazy(() => import('./pages/Dashboard'));
const GranaryDetail = lazy(() => import('./pages/GranaryDetail'));
const NewGranary = lazy(() => import('./pages/NewGranary'));
const EditGranary = lazy(() => import('./pages/EditGranary'));
const NewSnapshot = lazy(() => import('./pages/NewSnapshot'));
const EditSnapshot = lazy(() => import('./pages/EditSnapshot'));
const JudgmentDiaryList = lazy(() => import('./pages/JudgmentDiaryList'));
const JudgmentDiaryDetail = lazy(() => import('./pages/JudgmentDiaryDetail'));
const NewJudgmentDiary = lazy(() => import('./pages/NewJudgmentDiary'));
const EditJudgmentDiary = lazy(() => import('./pages/EditJudgmentDiary'));
const JudgmentDiaryActionArchive = lazy(() => import('./pages/JudgmentDiaryActionArchive'));
const JudgmentDiaryStrategyArchive = lazy(() => import('./pages/JudgmentDiaryStrategyArchive'));
const JudgmentDiaryPrinciples = lazy(() => import('./pages/JudgmentDiaryPrinciples'));
const JudgmentDiaryReport = lazy(() => import('./pages/JudgmentDiaryReport'));
const PublicPortfolio = lazy(() => import('./pages/PublicPortfolio'));
const LandingIntro = lazy(() => import('./pages/LandingIntro'));
const NewPosition = lazy(() => import('./pages/NewPosition'));
const EditPosition = lazy(() => import('./pages/EditPosition'));
const Login = lazy(() => import('./pages/Login'));
const Consulting = lazy(() => import('./pages/Consulting'));

/**
 * Browser route inventory and access policy.
 *
 * Add new pages to exactly one of these lists. App.tsx renders both lists, and
 * PRIVATE_ROUTES also drives the noindex policy so authentication and SEO do
 * not drift apart.
 */
export const PUBLIC_ROUTES: readonly AppRouteDefinition[] = [
  { path: '/', component: LandingIntro },
  { path: '/login', component: Login },
  { path: '/consulting', component: Consulting },
  { path: '/judgment-diary', component: JudgmentDiaryList },
  { path: '/judgment-diary/action/:action', component: JudgmentDiaryActionArchive },
  { path: '/judgment-diary/strategy/:strategy', component: JudgmentDiaryStrategyArchive },
  { path: '/judgment-diary/principles', component: JudgmentDiaryPrinciples },
  { path: '/judgment-diary/reports/:month', component: JudgmentDiaryReport },
  { path: '/judgment-diary/:slug', component: JudgmentDiaryDetail },
  { path: '/archive', component: PublicPortfolio },
];

export const PRIVATE_ROUTES: readonly AppRouteDefinition[] = [
  { path: '/dashboard', component: Dashboard },
  { path: '/granaries/:id', component: GranaryDetail },
  { path: '/granaries/:id/edit', component: EditGranary },
  { path: '/granaries/new', component: NewGranary },
  { path: '/snapshots/new', component: NewSnapshot },
  { path: '/snapshots/:id/edit', component: EditSnapshot },
  { path: '/positions/new', component: NewPosition },
  { path: '/positions/:id/edit', component: EditPosition },
  { path: '/judgment-diary/new', component: NewJudgmentDiary },
  { path: '/judgment-diary/:id/edit', component: EditJudgmentDiary },
];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTES.some(({ path }) => matchPath({ path, end: true }, pathname));
}

const ASSET_JOURNAL_PREFIXES = ['/dashboard', '/granaries', '/snapshots', '/positions'];

export function isAssetJournalPath(pathname: string): boolean {
  return ASSET_JOURNAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
