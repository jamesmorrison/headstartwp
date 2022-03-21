import { isInternalLink } from '..';

jest.mock('../getWPUrl', () => {
	return {
		getWPUrl: () => 'https://backendurl.com',
	};
});

describe('isInternalLink', () => {
	it('returns true for internal links', () => {
		expect(isInternalLink('https://backendurl.com/post-name')).toBe(true);

		expect(isInternalLink('https://backendurl.com/parent/post-name')).toBe(true);

		expect(isInternalLink('https://backendurl.com/parent/post-name?query=1')).toBe(true);

		expect(isInternalLink('https://backendurl.com/2022/10/20/post-name')).toBe(true);

		expect(isInternalLink('https://backendurl.com/')).toBe(true);

		expect(isInternalLink('https://backendurl.com')).toBe(true);
	});

	it('returns false for non-internal links', () => {
		expect(isInternalLink('https://externalurl.com/post-name')).toBe(false);

		expect(isInternalLink('https://externalurl.com/parent/post-name')).toBe(false);

		expect(isInternalLink('https://externalurl.com/parent/post-name?query=1')).toBe(false);

		expect(isInternalLink('https://externalurl.com/2022/10/20/post-name')).toBe(false);

		expect(isInternalLink('https://externalurl.com/')).toBe(false);

		expect(isInternalLink('https://externalurl.com')).toBe(false);
	});
});