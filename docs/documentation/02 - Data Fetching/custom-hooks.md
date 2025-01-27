---
slug: /data-fetching/creating-your-own-custom-hooks
sidebar_label: Creating your own custom hooks
---

# Custom hoooks

Sometimes it might be useful to wrap the framework data-fetching hooks into your own hooks.

## Creating a custom hook for a custom post type

Let's say you have a custom post type and you want to abstract the parameters needed to get that custom post type. You can create your own hook and pass in the required params.

```js title=src/hooks/useBook.js
import { usePost } from '@headstartwp/next';

const defaultParams = {
	postType: 'book',
	_embed: true,
};

export function useBook(params = {}) {
    return usePost({ ...params, ...defaultParams }, options);
}

useBook.fetcher = (sourceUrl?: string) => {
	const fetcher = usePost.fetcher(sourceUrl, defaultParams);
	return fetcher;
};
```

That way, you don't need to keep passing around the `defaultParams` whenever you want to fetch a single book.

By wrapping `useBook.fetcher` we can also pass a set of default params to the default `usePost` fetcher function. This ensures that when you use `fetchHookData` on the server, the data is fetched using the default parameters.

```js
// no need to manually pass `{ params: { postType: 'book' } }
const bookData = await fetchHookData(useBook.fetcher(), context);
```

This is also useful if you're using TypeScript and your custom post type has additional meta fields.

```js title=src/hooks/useBook.ts
import { usePost } from '@headstartwp/next';
import { PostEntity, PostParams } from '@headstartwp/core';

const defaultParams: PostParams = {
	postType: 'book',
	_embed: true,
};

interface Book extends PostEntity {
    isbn: string;
}

export function useBook(params: PostParams | {} = {}) {
    return usePost<Book>({ ...params, ...defaultParams }, options);
}

useBook.fetcher = (sourceUrl?: string) => {
	const fetcher = usePost.fetcher<Book>(sourceUrl, defaultParams);
	return fetcher;
};
```

Then when using the custom hook `isbn` will show up as a property of the returned post objects.

## Creating your own AppSettings hook

If you're using TypeScript and you are extending the framework's app endpoint and including new fields, you can create your own custom hook and specify the additional TypeScript types.

```js title=src/hooks/useMyAppSettings.ts
import { FetchResponse, AppEntity, AppSettingsStrategy } from '@headstartwp/core';
import { FetchHookOptions } from '@headstartwp/core/react';
import { useAppSettings } from '@headstartwp/next';

export interface MyAppSettings extends AppEntity {
    my_custom_setting: string;
}

export function useMyAppSettings(
	options: FetchHookOptions<FetchResponse<MyAppSettings>> = {},
) {
	return useAppSettings<MyAppSettings>({}, options);
}

useMyAppSettings.fetcher = (sourceUrl?: string) =>
	new AppSettingsStrategy<MyAppSettings>(sourceUrl);
```

## Custom Strategies

Depending on what you're doing you might need to create a completely custom Fetch Strategy. A Fetch strategy must extend [AbstractFetchStrategy](/api/classes/headstartwp_core.AbstractFetchStrategy/) and it must contain all of the logic needed to fetch the data.

If you feel like to need to create a custom strategy check out the [default Fetch Strategies](https://github.com/10up/headstartwp/tree/develop/packages/core/src/data/strategies) as well as the [hooks](https://github.com/10up/headstartwp/tree/develop/packages/core/src/react/hooks) that implements them.

