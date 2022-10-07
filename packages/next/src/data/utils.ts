import {
	getWPUrl,
	fetchRedirect,
	FilterDataOptions,
	AbstractFetchStrategy,
	EndpointParams,
	FetchResponse,
	FetchOptions,
} from '@10up/headless-core';
import { getHeadlessConfig } from '@10up/headless-core/utils';
import { GetServerSidePropsContext, GetServerSidePropsResult, GetStaticPropsContext } from 'next';
import { unstable_serialize } from 'swr';
import { PreviewData } from '../handlers/types';

/**
 * The supported options for {@link fetchHookData}
 */
export interface FetchHookDataOptions {
	/**
	 * This should match params passed to the hook on the client side.
	 */
	params?: any;

	/**
	 * Optional. If set, the data will be filtered given {@link FilterDataOptions}
	 */
	filterData?: FilterDataOptions;

	/**
	 * Optional. If set, will fowardh fetch options to the fetch strategy
	 */
	fetchStrategyOptions?: FetchOptions;
}

/**
 * Creates a path from array of arguments
 *
 * @param args - Array of catch-all arguments
 *
 * @category Next.js Data Fetching Utilities
 */
export function convertToPath(args: string[] | undefined) {
	if (!args) {
		return '/';
	}

	return `/${args.join('/')}`;
}

/**
 * A function that implementeds data fetching on the server. This should be used in `getServerSideProps`
 * or `getStaticProps`.
 *
 * Data fetching will be perfomed by the specified strategy and URL params will be automatically extracted
 * from `context
 *
 * ## Usage
 *
 * ```ts
 * export async function getServerSideProps(context) {
 *	try {
 * 		const usePostsHook = await fetchHookData(usePosts.fetcher(),context);
 *
 *		return addHookData([usePostsHook], {});
 *	} catch (e) {
 *		return handleError(e, context);
 *	}
 * }
 * ```
 *
 * @param fetchStrategy The fetch strategy to use. Typically this is exposed by the hook e.g: `usePosts.fetcher()`
 * @param ctx The Next.js context, either the one from `getServerSideProps` or `getStaticProps`
 * @param options See {@link FetchHookDataOptions}
 *
 * @returns An object with a key of `data` and a value of the fetched data.
 *
 * @category Next.js Data Fetching Utilities
 */
export async function fetchHookData(
	fetchStrategy: AbstractFetchStrategy<any, EndpointParams>,
	ctx: GetServerSidePropsContext<any, PreviewData> | GetStaticPropsContext<any, PreviewData>,
	options: FetchHookDataOptions = {},
) {
	const wpURL = getWPUrl();
	const params = options?.params || {};
	const filterDataOptions = options?.filterData || { method: 'ALLOW', fields: ['*'] };

	fetchStrategy.setBaseURL(wpURL);

	let path: string[] = [];

	if (ctx.params) {
		path = Array.isArray(ctx.params.path) ? ctx.params.path : [ctx.params.path || ''];
	}

	const urlParams = fetchStrategy.getParamsFromURL(convertToPath(path), params);
	const finalParams = { _embed: true, ...urlParams, ...params };

	// we don't want to include the preview params in the key
	const key = { url: fetchStrategy.getEndpoint(), args: finalParams };

	const isPreviewRequest =
		typeof urlParams.slug === 'string' ? urlParams.slug.includes('-preview=true') : false;

	if (ctx.preview && ctx.previewData && isPreviewRequest) {
		finalParams.id = ctx.previewData.id;
		finalParams.revision = ctx.previewData.revision;
		finalParams.postType = ctx.previewData.postType;
		finalParams.authToken = ctx.previewData.authToken;
	}

	const data = await fetchStrategy.fetcher(
		fetchStrategy.buildEndpointURL(finalParams),
		finalParams,
		options.fetchStrategyOptions,
	);

	data.queriedObject = fetchStrategy.getQueriedObject(data, finalParams);

	return {
		key: unstable_serialize(key),
		data: fetchStrategy.filterData(data, filterDataOptions),
	};
}

type ExpectedHookStateResponse = {
	yoast_head_json: Record<string, any> | null;
	yoast_head: string | null;
	'theme.json': Record<string, any> | null;
};

export type HookState = {
	key: string;
	data: FetchResponse<ExpectedHookStateResponse> | FetchResponse<ExpectedHookStateResponse[]>;
};

/**
 * The `addHookData` function is responsible for collecting all of the results from the `fetchHookData` function calls
 * and prepares the shape of the data to match what the frameworks expects (such as setting initial values for SWR and collecting SEO data).
 *
 * ## Usage
 *
 * ```ts
 * export async function getServerSideProps(context) {
 *	try {
 * 		const usePostsHook = await fetchHookData(usePosts.fetcher(),context);
 *		const useAppSettingsHook = await fetchHookData(useAppSettings.fetcher(),context);
 *		return addHookData([usePostsHook, useAppSettingsHook], {});
 *	} catch (e) {
 *		return handleError(e, context);
 *	}
 * }
 * ```
 *
 * @param hookStates An array of resolved promises from {@link fetchHookData}
 * @param nextProps Any additional props to pass to Next.js page routes.
 *
 * @category Next.js Data Fetching Utilities
 */
export function addHookData(hookStates: HookState[], nextProps) {
	const { props = {}, ...rest } = nextProps;
	const fallback = {};
	let seo_json = {};
	let themeJSON = {};

	hookStates.filter(Boolean).forEach((hookState) => {
		const { key, data } = hookState;

		// no need to add this to next.js props
		if (data.queriedObject) {
			data.queriedObject = {};
		}

		// we want to keep only one yoast_head_json object and remove everyhing else to reduce
		// hydration costs
		if (Array.isArray(data.result) && data.result.length > 0) {
			if (data.result[0]?.yoast_head_json) {
				seo_json = { ...data.result[0].yoast_head_json };
			}

			if (data.result[0]?.['theme.json']) {
				themeJSON = { ...data.result[0]['theme.json'] };
			}

			data.result.forEach((post) => {
				if (post?.yoast_head_json) {
					post.yoast_head_json = null;
				}
				if (post?.yoast_head) {
					post.yoast_head = null;
				}
				if (post?.['theme.json']) {
					post['theme.json'] = null;
				}
			});
		} else if (!Array.isArray(data.result)) {
			if (data.result?.yoast_head_json) {
				seo_json = { ...data.result.yoast_head_json };
				data.result.yoast_head_json = null;
			}
			if (data.result?.yoast_head) {
				data.result.yoast_head = null;
			}
			if (data.result?.['theme.json']) {
				themeJSON = data.result['theme.json'];
				data.result['theme.json'] = null;
			}
		}

		fallback[key] = data;
	});

	return {
		...rest,
		props: {
			...props,
			seo: {
				yoast_head_json: seo_json,
			},
			themeJSON,
			fallback,
		},
	};
}

function isStringArray(el): el is string[] {
	return Array.isArray(el);
}

/**
 * The `handleError` function is responsible for handling errors that occur during
 * data fetching in `getServerSideProps` or `getStaticProps`.
 *
 * It also handles redirects if `redirectStrategy` is set to `404` in `headless.config.js`
 *
 * If `error` is of type {@link NotFoundError} it will redirect to the 404 page. Otherwise it will
 * return a server error (500) page
 * ## Usage
 *
 * ```ts
 * export async function getServerSideProps(context) {
 *	try {
 * 		const usePostsHook = await fetchHookData(usePosts.fetcher(),context);
 *		return addHookData([usePostsHook], {});
 *	} catch (e) {
 *		return handleError(e, context);
 *	}
 * }
 * ```
 *
 * @param error The error object
 * @param ctx The Next.js context
 * @param rootRoute The root route (deprecated/unnecessary). This needs to be revisited
 *
 * @category Next.js Data Fetching Utilities
 */
export async function handleError(
	error: Error,
	ctx: GetServerSidePropsContext,
	rootRoute: string = '',
): Promise<GetServerSidePropsResult<{}>> {
	const { redirectStrategy } = getHeadlessConfig();

	if (error.name === 'NotFoundError') {
		let pathname = '';
		if (typeof ctx?.req?.url !== 'undefined') {
			pathname = ctx.req.url;
		} else {
			// build out the url from params.path
			pathname =
				typeof ctx?.params !== 'undefined' && isStringArray(ctx.params?.path)
					? `${rootRoute}/${ctx.params.path.join('/')}`
					: `${rootRoute}/${ctx.params?.path as string}`;
		}

		if (redirectStrategy === '404' && pathname) {
			const redirect = await fetchRedirect(pathname);

			if (redirect.location) {
				return {
					redirect: {
						destination: redirect.location,
						permanent: false,
					},
				};
			}
		}

		return { notFound: true };
	}

	throw error;
}
