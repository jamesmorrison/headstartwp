import { usePosts, fetchHookData, addHookData } from '@10up/headless-next/data';
import { handleError } from '@10up/headless-next';

const Template = () => {
	const { data, error, loading } = usePosts({ postType: 'book', genre: 'action' });

	if (error) {
		return 'error';
	}

	return loading ? (
		'Loading...'
	) : (
		<ul>
			{data.posts.map((post) => (
				<li key={post.id}>{post.title.rendered}</li>
			))}
		</ul>
	);
};

export default Template;

export async function getServerSideProps(context) {
	try {
		const hookData = await fetchHookData('usePosts', context, {
			postType: 'book',
			genre: 'action',
		});

		return addHookData([hookData], {});
	} catch (e) {
		return handleError(e, context);
	}
}
