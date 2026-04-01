type IssueDetailSource = "issues" | "inbox";

type IssueDetailBreadcrumb = {
  label: string;
  href: string;
};

type IssueDetailSourceLabels = Partial<Record<IssueDetailSource, string>>;

type IssueDetailLocationState = {
  issueDetailBreadcrumb?: IssueDetailBreadcrumb;
  issueDetailSource?: IssueDetailSource;
};

const ISSUE_DETAIL_SOURCE_QUERY_PARAM = "from";

function isIssueDetailBreadcrumb(value: unknown): value is IssueDetailBreadcrumb {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<IssueDetailBreadcrumb>;
  return typeof candidate.label === "string" && typeof candidate.href === "string";
}

function isIssueDetailSource(value: unknown): value is IssueDetailSource {
  return value === "issues" || value === "inbox";
}

function readIssueDetailSource(state: unknown): IssueDetailSource | null {
  if (typeof state !== "object" || state === null) return null;
  const source = (state as IssueDetailLocationState).issueDetailSource;
  return isIssueDetailSource(source) ? source : null;
}

function readIssueDetailSourceFromSearch(search?: string): IssueDetailSource | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const source = params.get(ISSUE_DETAIL_SOURCE_QUERY_PARAM);
  return isIssueDetailSource(source) ? source : null;
}

function breadcrumbForSource(
  source: IssueDetailSource,
  labels?: IssueDetailSourceLabels,
): IssueDetailBreadcrumb {
  if (source === "inbox") return { label: labels?.inbox ?? "Inbox", href: "/inbox" };
  return { label: labels?.issues ?? "Issues", href: "/issues" };
}

export function createIssueDetailLocationState(
  label: string,
  href: string,
  source?: IssueDetailSource,
): IssueDetailLocationState {
  return {
    issueDetailBreadcrumb: { label, href },
    issueDetailSource: source,
  };
}

export function createIssueDetailPath(issuePathId: string, state?: unknown, search?: string): string {
  const source = readIssueDetailSource(state) ?? readIssueDetailSourceFromSearch(search);
  if (!source) return `/issues/${issuePathId}`;
  const params = new URLSearchParams();
  params.set(ISSUE_DETAIL_SOURCE_QUERY_PARAM, source);
  return `/issues/${issuePathId}?${params.toString()}`;
}

export function readIssueDetailBreadcrumb(
  state: unknown,
  search?: string,
  labels?: IssueDetailSourceLabels,
): IssueDetailBreadcrumb | null {
  const source = readIssueDetailSource(state) ?? readIssueDetailSourceFromSearch(search);
  if (source) {
    const candidate =
      typeof state === "object" && state !== null
        ? (state as IssueDetailLocationState).issueDetailBreadcrumb
        : null;
    const fallback = breadcrumbForSource(source, labels);
    if (isIssueDetailBreadcrumb(candidate)) {
      return {
        label: fallback.label,
        href: candidate.href,
      };
    }
    return fallback;
  }

  if (typeof state === "object" && state !== null) {
    const candidate = (state as IssueDetailLocationState).issueDetailBreadcrumb;
    if (isIssueDetailBreadcrumb(candidate)) return candidate;
  }

  return null;
}
