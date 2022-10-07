import { renderHook } from '@testing-library/react-hooks';
import * as React from 'react';
import { SettingsProvider } from '../../provider';
import { useFetchPost } from '../useFetchPost';

describe('useFetchPost', () => {
	const wrapper = ({ children }) => {
		return <SettingsProvider settings={{ sourceUrl: '' }}>{children}</SettingsProvider>;
	};

	it('throwns errors if accessing data before fetch', async () => {
		const { result, waitForNextUpdate } = renderHook(
			() => useFetchPost({ slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto' }),
			{ wrapper },
		);

		// should throw before we have any actual results
		expect(() => result.current.data?.post.title).toThrow(
			'You are trying to access "post.title" but it is not avaliable yet. Did you forget to fetch data on the server? Otherwise, handle the loading and error states accordingly',
		);
		expect(result.current.loading).toBe(true);

		await waitForNextUpdate();

		expect(result.current.error).toBeUndefined();
		expect(result.current.loading).toBe(false);
		expect(() => result.current.data).not.toThrow();
	});

	it('fetches data properly', async () => {
		const { result, waitForNextUpdate } = renderHook(
			() => useFetchPost({ slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto' }),
			{ wrapper },
		);

		await waitForNextUpdate();

		expect(result.current.data?.post.slug).toBe(
			'modi-qui-dignissimos-sed-assumenda-sint-iusto',
		);
	});

	it('fetch by id', async () => {
		const { result, waitForNextUpdate } = renderHook(() => useFetchPost({ id: 64 }), {
			wrapper,
		});

		await waitForNextUpdate();
		expect(result.current.data?.post.id).toBe(64);
		expect(result.current.data?.post.slug).toBe('ipsum-repudiandae-est-nam');
	});

	it('errors if fetches draft posts without authToken', async () => {
		// 57 is a hardcoded draft post in msw
		const { result, waitForNextUpdate } = renderHook(() => useFetchPost({ id: 57 }), {
			wrapper,
		});

		await waitForNextUpdate();

		expect(result.current.error).toBeTruthy();
	});

	it('fetches draft posts with authToken', async () => {
		// 57 is a hardcoded draft post in msw
		const { result, waitForNextUpdate } = renderHook(
			() => useFetchPost({ id: 57, authToken: 'Fake Auth Token' }),
			{
				wrapper,
			},
		);

		await waitForNextUpdate();

		expect(result.current.error).toBeFalsy();
		expect(result.current.data?.post.id).toBe(57);
	});

	it('errors if fetches revisions without authToken', async () => {
		const { result, waitForNextUpdate } = renderHook(
			() => useFetchPost({ id: 57, revision: true }),
			{
				wrapper,
			},
		);

		await waitForNextUpdate();

		expect(result.current.error).toBeTruthy();
	});

	it('fetches revisions with authToken', async () => {
		const { result, waitForNextUpdate } = renderHook(
			() => useFetchPost({ id: 64, revision: true, authToken: 'Fake Auth Token' }),
			{
				wrapper,
			},
		);

		await waitForNextUpdate();

		expect(result.current.error).toBeFalsy();
		expect(result.current.data?.post.id).toBe(64);
		expect(result.current.data?.post.slug).toBe('ipsum-repudiandae-est-nam');
	});

	it('keeps backwards compatibility with swr options and that a warning is made', async () => {
		// eslint-disable-next-line no-console
		console.warn = jest.fn();

		// should not fetch anything
		const { result, waitForNextUpdate } = renderHook(
			() =>
				useFetchPost(
					{ slug: 'random slug' },
					{
						// @ts-expect-error
						revalidateOnMount: false,
					},
				),
			{
				wrapper,
			},
		);

		await expect(() => waitForNextUpdate()).rejects.toThrow();

		// eslint-disable-next-line no-console
		expect(console.warn).toHaveBeenCalledTimes(1);

		// eslint-disable-next-line no-console
		expect(console.warn).toHaveBeenCalledWith(
			'useSWR options should be passed under the swr namespace. "{ swr: {"revalidateOnMount":false} }"',
		);

		expect(result.current.error).toBeFalsy();
	});

	it('respect swr option', async () => {
		// should not fetch anything
		const { result, waitForNextUpdate } = renderHook(
			() =>
				useFetchPost(
					{ slug: 'random slug' },
					{
						swr: {
							revalidateOnMount: false,
						},
					},
				),
			{
				wrapper,
			},
		);

		await expect(() => waitForNextUpdate()).rejects.toThrow();

		expect(result.current.error).toBeFalsy();
	});
});
