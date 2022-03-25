import { SWRConfiguration } from 'swr';
import { getCustomTaxonomySlugs, getWPUrl } from '../../utils';
import { FetchResponse, PostsArchiveFetchStrategy, PostsArchiveParams } from '../strategies';
import { HookResponse, PageInfo, PostEntity } from '../types';
import { getPostAuthor, getPostTerms } from '../utils';
import { useFetch } from './useFetch';

type PageType = {
	/**
	 * Regular post archive
	 */
	isPostArchive: boolean;
	/**
	 * Search route
	 */
	isSearch: boolean;
	/**
	 * Author Archive
	 */
	isAuthorArchive: boolean;
	/**
	 * Custom Post Type Archive
	 */
	isPostTypeArchive: boolean;
	/**
	 * Which post type this archive is for
	 */
	postType: string;
	/**
	 * Category Archive
	 */
	isCategoryArchive: boolean;
	/**
	 * Tag Archive
	 */
	isTagArchive: boolean;
	/**
	 * Custom Taxonomy Archive
	 */
	isTaxonomyArchive: boolean;
	/**
	 * Which taxonomy this archive is for
	 */
	taxonomy: string;
};

export interface usePostsResponse extends HookResponse {
	data?: { posts: PostEntity[]; pageInfo: PageInfo };
	pageType: PageType;
}

/**
 * The usePost hook. Returns a collection of post entities
 *
 * @param params The list of params to pass to the fetch strategy. It overrides the ones in the URL.
 * @param options The options to pass to the swr hook.
 * @param path The path of the url to get url params from.
 *
 * @returns
 */
export function usePostsImpl(
	params: PostsArchiveParams,
	options: SWRConfiguration<FetchResponse<PostEntity>> = {},
	path = '',
): usePostsResponse {
	const {
		data,
		error,
		params: queryParams,
	} = useFetch<PostEntity, PostsArchiveParams>(
		{ _embed: true, ...params },
		usePostsImpl.fetcher(),
		options,
		path,
	);

	const pageType: PageType = {
		isPostArchive: false,
		isSearch: false,
		isAuthorArchive: false,
		isPostTypeArchive: false,
		postType: '',
		isCategoryArchive: false,
		isTagArchive: false,
		isTaxonomyArchive: false,
		taxonomy: '',
	};

	if (queryParams.author) {
		pageType.isPostArchive = true;
		pageType.isAuthorArchive = true;
	}

	if (queryParams.category) {
		pageType.isPostArchive = true;
		pageType.isCategoryArchive = true;
	}

	if (queryParams.tag) {
		pageType.isPostArchive = true;
		pageType.isTagArchive = true;
	}

	if (queryParams.postType) {
		pageType.isPostArchive = false;
		pageType.isPostTypeArchive = true;
		pageType.postType = queryParams.postType;
	} else {
		pageType.isPostArchive = true;
	}

	const taxonomies = getCustomTaxonomySlugs();
	taxonomies.forEach((taxonmy) => {
		if (queryParams[taxonmy]) {
			pageType.isTaxonomyArchive = true;
			pageType.taxonomy = taxonmy;
		}
	});

	if (error) {
		return { error, loading: false, pageType };
	}

	if (!data) {
		return { loading: true, pageType };
	}

	const { result, pageInfo } = data;

	// TODO: fix types
	const posts = (result as unknown as PostEntity[]).map((post) => {
		post.author = getPostAuthor(post);
		post.terms = getPostTerms(post);

		return post;
	});

	return { data: { posts, pageInfo }, loading: false, pageType };
}

usePostsImpl.fetcher = () => new PostsArchiveFetchStrategy(getWPUrl());
