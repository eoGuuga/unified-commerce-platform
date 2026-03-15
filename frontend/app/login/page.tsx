import LoginExperience from './LoginExperience';

type SearchParams = {
  redirect?: string | string[];
};

type LoginPageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

function resolveRedirectTarget(target?: string | string[]) {
  if (typeof target === 'string' && target.startsWith('/')) {
    return target;
  }

  return '/admin';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined;

  return <LoginExperience redirectTarget={resolveRedirectTarget(params?.redirect)} />;
}
