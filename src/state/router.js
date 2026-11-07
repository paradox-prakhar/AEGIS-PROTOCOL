import { useEffect, useState } from 'react';

function parse() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || 'overview', params: Object.fromEntries(new URLSearchParams(query)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => { setRoute(parse()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path, params) {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  window.location.hash = `/${path}${q}`;
}
