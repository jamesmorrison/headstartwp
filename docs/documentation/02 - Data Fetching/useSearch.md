---
slug: /data-fetching/usesearch
sidebar_position: 5
---

# The useSearch hook

> The [useSearch](/api/modules/headstartwp_next#usesearch) hook is the Next.js binding for the [useFetchSearch](/api/namespaces/headstartwp_core.react#usefetchsearch).

The `useSearch` hook searches for WordPress posts from a registered post type.

## Basic Usage

Assuming a `src/pages/search/[[...path]].js` route with the following content.

:::info
This example is using the optional catch-all route `[[..path]].js` because we want the `/search` route to be handled by the same file and fetch the latest posts.
:::info
```js title="src/pages/search/[[...path]].js"
import { useSearch } from '@headstartwp/next';

const ArchivePage = () => {
	const { loading, error, data } = useSearch({ per_page: 10 });

	if (loading) {
		return 'Loading...';
	}

	if (error) {
		return 'error...';
	}

	return (
		<div>
            {data?.posts?.map((post) => (
                <h2 key={post.id}>{post.title.rendered}</h2>
            ))}
		</div>
	);
};
```

The route will automatically render the latest 10 posts if no search term is provided. The following paths are automatically handled:

- /search/search-term
- /search/search-term/page/2
- /search

## QueriedObject

The `useSearch` hook also exposes a `queriedObject`. See [usePosts docs](/learn/data-fetching/useposts/#queried-object) for more info.

The queried object for for this hook is an object of type [SearchEnrity](/api/interfaces/headstartwp_core.SearchEntity/).

## Known limitations

- It is not possible to fetch posts from more than one post type.
