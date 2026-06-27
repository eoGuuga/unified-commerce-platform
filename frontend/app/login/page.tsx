import LoginExperience from './LoginExperience';

type SearchParams = {
  redirect?: string | string[];
};

function resolveRedirectTarget(target?: string | string[]) {
  if (typeof target === 'string' && target.startsWith('/')) {
    return target;
  }

  return '/admin';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return <LoginExperience redirectTarget={resolveRedirectTarget(params?.redirect)} />;
}
