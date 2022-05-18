import {
	getHeadlessConfig,
	getCustomTaxonomySlugs,
	getCustomTaxonomies,
	asyncForEach,
	getCustomPostType,
	ConfigError,
	NotFoundError,
	addQueryArgs,
} from '../../utils';
import { endpoints } from '../utils';
import { apiGet } from '../api';
import { PostEntity } from '../types';
import { postsMatchers } from '../utils/matchers';
import { parsePath } from '../utils/parsePath';
import { FetchOptions, AbstractFetchStrategy, EndpointParams } from './AbstractFetchStrategy';

const authorsEndpoint = '/wp-json/wp/v2/users';

/**
 * The EndpointParams supported by the [[PostsArchiveFetchStrategy]]
 */
export interface PostsArchiveParams extends EndpointParams {
	/**
	 * Current page of the collection.
	 *
	 * @default 1
	 */
	page: number;

	/**
	 * If set will filter results by the specified category name
	 *
	 * It supports both a category id and category slug
	 */
	category: string;

	/**
	 * If set will filter results by the specified tag name
	 *
	 * It supports both a category id and category slug
	 */
	tag: string;

	/**
	 * If set will filter results by the specified year
	 */
	year: string;

	/**
	 * If set will filter results by the specified month
	 */
	month: string;

	/**
	 * If set will filter results by the specified day
	 */
	day: string;

	/**
	 * Maximum number of items to be returned in result set.
	 *
	 * @default 10
	 */
	per_page: number;

	/**
	 * Limit results to those matching a string.
	 */
	search: string;

	/**
	 * Limit result set to posts assigned to specific authors.
	 */
	author: number | number[] | string;

	/**
	 * Ensure result set excludes posts assigned to specific authors.
	 */
	author_exclude: number | number[];

	/**
	 * Ensure result set excludes specific IDs.
	 */
	exclude: number[];

	/**
	 * Limit result set to specific IDs.
	 */
	include: number[];

	/**
	 * Offset the result set by a specific number of items.
	 */
	offset: number;

	/**
	 * Order sort attribute ascending or descending.
	 *
	 * @default 'desc'
	 */
	order: 'asc' | 'desc';

	/**
	 * The post type to query for.
	 *
	 * @default 'post'
	 */
	postType: string;

	/**
	 * Limit result set to posts with one or more specific slugs.
	 */
	slug: string | string[];

	/**
	 * Sort collection by object attribute.
	 *
	 * @default 'date'
	 */
	orderby:
		| 'author'
		| 'date'
		| 'id'
		| 'include'
		| 'modified'
		| 'parent'
		| 'relevance'
		| 'slug'
		| 'include_slugs'
		| 'title';

	/**
	 * Limit result set to posts assigned one or more statuses.
	 *
	 * @default 'publish'
	 */
	status: string | string[];

	/**
	 * Limit result set based on relationship between multiple taxonomies.
	 */
	tax_relation: 'AND' | 'OR';

	/**
	 * Limit result set to all items that have the specified term assigned in the categories taxonomy.
	 */
	categories: number | number[] | string | string[];

	/**
	 * Limit result set to all items except those that have the specified term assigned in the categories taxonomy.
	 */
	categories_exclude: number | number[];

	/**
	 * Limit result set to all items that have the specified term assigned in the tags taxonomy.
	 */
	tags: number | number[] | string | string[];

	/**
	 * Limit result set to all items except those that have the specified term assigned in the tags taxonomy.
	 */
	tags_exclude: number | number[];

	/**
	 * Limit result set to items that are sticky.
	 */
	sticky: boolean;
}

/**
 * The PostsArchiveFetchStrategy is used to fetch a collection of posts from any post type.
 * Note that custom post types and custom taxonomies should be defined in `headless.config.js`
 *
 * This strategy supports extracting endpoint params from url E.g:
 * - `/category/cat-name/page/2` maps to `{ category: 'cat-name', page: 2 }`
 * - `/page/2/` maps to `{ page: 2 }`
 * - `/genre/genre-name/page/2` maps to `{ genre: 'genre-name', page: 2 }` if a `genre` taxonomy is defined in `headless.config.js`
 *
 * @see [[getParamsFromURL]] to learn about url param mapping
 *
 * @category Data Fetching
 */
export class PostsArchiveFetchStrategy extends AbstractFetchStrategy<
	PostEntity,
	PostsArchiveParams
> {
	getDefaultEndpoint(): string {
		return endpoints.posts;
	}

	/**
	 * This strategy automatically extracts taxonomy filters, date filters and paginations params from the URL
	 *
	 * It also takes into account the custom taxonomies specified in `headless.config.js`
	 *
	 * @param path The URL path to extract params from
	 */
	getParamsFromURL(path: string): Partial<PostsArchiveParams> {
		const matchers = [...postsMatchers];

		const customTaxonomies = getCustomTaxonomies();
		customTaxonomies?.forEach((taxonomy) => {
			const slug = taxonomy?.rewrite ?? taxonomy.slug;
			matchers.push({
				name: taxonomy.slug,
				priority: 30,
				pattern: `/${slug}/:${slug}`,
			});

			matchers.push({
				name: `${taxonomy.slug}-with-pagination`,
				priority: 30,
				pattern: `/${slug}/:${slug}/page/:page`,
			});
		});

		return parsePath(matchers, path);
	}

	/**
	 * Handles taxonomy filters and switch endpoint based on post type
	 *
	 * @param params The params to build the endpoint with
	 */
	buildEndpointURL(params: Partial<PostsArchiveParams>) {
		const settings = getHeadlessConfig();

		// don't use the category slug to build out the URL endpoint
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { category, tag, postType, ...endpointParams } = params;

		const taxonomies = getCustomTaxonomySlugs();

		taxonomies.forEach((taxonomy) => {
			if (endpointParams[taxonomy]) {
				delete endpointParams[taxonomy];
			}
		});

		if (params.postType) {
			const postType = getCustomPostType(params.postType);

			if (!postType) {
				throw new ConfigError(
					'Unkown post type, did you forget to add it to headless.config.js?',
				);
			}

			this.setEndpoint(postType.endpoint);
		}

		// if an author slug was passed
		// and we're not using the WordPress plugin
		// we don't want to include it in the endpoint as is as we need to fetch the author id first.
		if (params.author && typeof params.author === 'string' && !settings.useWordPressPlugin) {
			delete endpointParams.author;
		}

		return super.buildEndpointURL(endpointParams);
	}

	/**
	 * Before fetching posts, we need handle taxonomy and authors.
	 *
	 * If the headless plugin is not being used, then additioinal requests needs to be made to get
	 * authors and terms ids
	 *
	 * @param url The URL to parse
	 * @param params The params to build the endpoint with
	 * @param options FetchOptions
	 */
	async fetcher(
		url: string,
		params: Partial<PostsArchiveParams>,
		options: Partial<FetchOptions> = {},
	) {
		let finalUrl = url;
		const settings = getHeadlessConfig();

		const customTaxonomies = getCustomTaxonomies();
		if (customTaxonomies) {
			await asyncForEach(customTaxonomies, async (taxonomy) => {
				const paramSlug = taxonomy?.rewrite ?? taxonomy.slug;
				const restParam = taxonomy?.restParam ?? taxonomy.slug;

				if (!params[paramSlug]) {
					return;
				}

				if (settings.useWordPressPlugin) {
					// WordPress plugin extends the REST API to accept a category slug instead of just an id
					finalUrl = addQueryArgs(finalUrl, { [restParam]: params[paramSlug] });
				} else {
					const terms = await apiGet(
						`${this.baseURL}${taxonomy.endpoint}?slug=${params[paramSlug]}`,
					);

					if (terms.json.length > 0) {
						finalUrl = addQueryArgs(finalUrl, {
							[restParam]: terms.json[0].id,
						});
					} else {
						throw new NotFoundError(
							`Term "${params[paramSlug]}" from "${taxonomy.slug}" has not been found`,
						);
					}
				}
			});
		}

		// check if we need to fetch author id
		// we need to fetch author id if
		// 1 - params.author is a string
		// 2 - We're not using the WP Plugin
		if (params.author && typeof params.author === 'string' && !settings.useWordPressPlugin) {
			const authors = await apiGet(`${this.baseURL}${authorsEndpoint}?slug=${params.author}`);

			if (authors.json.length > 0) {
				finalUrl = addQueryArgs(finalUrl, {
					author: authors.json[0].id,
				});
			} else {
				throw new NotFoundError(`Author "${params.author}" not found`);
			}
		}

		return super.fetcher(finalUrl, params, options);
	}
}
