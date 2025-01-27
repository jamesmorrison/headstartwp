import parse, { HTMLReactParserOptions, domToReact, Element } from 'html-react-parser';
import React, { isValidElement, ReactElement, ReactNode } from 'react';
import type { IWhiteList } from 'xss';
import { isBlock, wpKsesPost } from '../../dom';
import { HeadlessConfig } from '../../types';
import { warn } from '../../utils';
import { IBlockAttributes } from '../blocks/types';
import { useSettings } from '../provider';
import { getInlineStyles } from '../blocks/utils';

/**
 * The interface any children of {@link BlocksRenderer} must implement.
 */
export interface BlockProps {
	/**
	 * A test function receives a domNode and returns a boolean value indicating
	 * whether that domNode should be replaced with the React component
	 */
	test?: (domNode: Element, site?: HeadlessConfig) => boolean;

	/**
	 * An optional exclude function that also receives a domNode and is executed against every child
	 * of the node being replaced with a react component.
	 *
	 * This is useful to selectively disregard certain children of a node when replacing with a react component.
	 */
	exclude?: (childNode: Element, site?: HeadlessConfig) => boolean;

	/**
	 * The tag name of the domNode that should be replaced with the react component
	 *
	 * If a test function is not supplied, then passing tagName is mandatory
	 */
	tagName?: string;

	/**
	 * The class name of the domNode that should be replaced with the react component
	 *
	 * If tagName is specified, then classList is mandatory
	 */
	classList?: string[] | string;

	/**
	 * The actual domNode that was replaced with the react component
	 */
	domNode?: Element;

	/**
	 * The children of the domNode that was replaced with the react component
	 *
	 * Note: the children of the domNode are recursively parsed.
	 */
	children?: ReactNode;

	/**
	 * The style tag of the domNode as an object.
	 */
	style?: Record<string, string>;
}

/**
 * The common interface for a block transform component
 */
export interface IBlock<T extends IBlockAttributes> extends Omit<BlockProps, 'test'> {
	domNode?: Element;
	className?: string;
	component: (props: T) => ReactElement | null;
}

/**
 * The type definition for the {@link BlocksRenderer} component.
 */
export interface BlockRendererProps {
	/**
	 * The HTML string to be parsed.
	 *
	 * ```jsx
	 * <BlocksRenderer
	 *		html="<div><p>hello world</p> div content</div>"
	 * />,
	 * ```
	 */
	html: string;

	/**
	 * The allow list for the parser
	 *
	 * ```jsx
	 * <BlocksRenderer
	 *		html="<div><p>hello world</p> div content</div>"
	 *		ksesAllowList={{ div: [] }}
	 * />,
	 * ```
	 */
	ksesAllowList?: IWhiteList;

	/**
	 * A custom implementation of the sanitize function.
	 *
	 * If none is provided it's going to default to {@link wpKsesPost}
	 */
	sanitizeFn?: (html: string, ksesAllowList?: IWhiteList) => string;

	/**
	 * The children components that must implements {@link BlockProps}. Failing to implement {@link BlockProps}
	 * will issue a warning at runtime.
	 *
	 * Passing children are not mandatory, if you do not pass them `BlocksRenderer` will simply sanitize the html markup.
	 */
	children?: ReactNode;
}

const shouldReplaceWithBlock = (block: ReactNode, domNode: Element, site?: HeadlessConfig) => {
	if (!isValidElement<BlockProps>(block)) {
		return false;
	}

	const { test: testFn, tagName, classList } = block.props;
	const hasTestFunction = typeof testFn === 'function';

	if (hasTestFunction) {
		return testFn(domNode, site);
	}

	if (typeof tagName === 'string' && typeof classList !== 'undefined') {
		return isBlock(domNode, { tagName, className: classList });
	}

	return false;
};

/**
 * The `BlocksRenderer` components provides an easy way to convert HTML markup into corresponding
 * React components.
 *
 * The `BlocksRenderer` component takes in arbitrary html markup and receives a list of react components
 * as children that allows replacing dom nodes with React Components.
 *
 * The html prop is sanitized through {@link wpKsesPost} so it's safe for rendering arbitrary html markup.
 *
 * The children components must implement the {@link BlockProps} interface
 *
 * ## Usage
 *
 * ### Usage with the test function
 *
 * ```jsx
 * <BlocksRenderer html={html}>
 *  <MyLinkBlock test={(node) => isAnchorTag(node, { isInternalLink: true })} />
 * </BlocksRenderer>
 * ```
 *
 * ### Usage with classList and tagName props
 *
 * ```jsx
 * <BlocksRenderer html={html}>
 *   <MyLinkBlock tagName="a" classList="my-special-anchor" />
 * </BlocksRenderer>
 * ```
 *
 * @param props Component properties
 *
 * @category React Components
 */
export function BlocksRenderer({ html, ksesAllowList, sanitizeFn, children }: BlockRendererProps) {
	const blocks: ReactNode[] = React.Children.toArray(children);
	const settings = useSettings();

	// Check if components[] has a non-ReactNode type Element
	// const hasInvalidComponent: boolean = blocks.findIndex((block) => !isValidElement(block)) !== -1;
	const hasInvalidComponent: boolean =
		blocks.findIndex((block) => {
			if (!isValidElement<BlockProps>(block)) {
				return true;
			}

			const { test: testFn, tagName, classList } = block.props;
			const hasTestFunction = typeof testFn === 'function';

			// if has a test function component is not invalid
			if (hasTestFunction) {
				return false;
			}

			// if does not have a test function it must have tagName and classList
			// if it does then it is not invalid
			if (typeof tagName !== 'undefined' && typeof classList !== 'undefined') {
				return false;
			}

			// otherwise it is invalid
			return true;
		}) !== -1;

	if (hasInvalidComponent) {
		warn('Children of <BlocksRenderer /> component should be a type of ReactNode<BlockProps>');
	}

	const cleanedHTML =
		typeof sanitizeFn === 'function'
			? sanitizeFn(html, ksesAllowList)
			: wpKsesPost(html, ksesAllowList);

	const options: HTMLReactParserOptions = {
		replace: (domNode) => {
			let component: ReactNode = null;

			blocks.forEach((block) => {
				if (
					isValidElement<BlockProps>(block) &&
					shouldReplaceWithBlock(block, domNode as Element, settings)
				) {
					const style = getInlineStyles(domNode as Element);

					component = React.createElement(
						block.type,
						{
							...block.props,
							domNode,
							style: style || undefined,
						},
						(domNode as Element)?.children
							? domToReact((domNode as Element)?.children, {
									// eslint-disable-next-line react/no-unstable-nested-components
									replace: (childNode) => {
										if (typeof options.replace !== 'function') {
											return undefined;
										}

										if (
											typeof block.props.exclude === 'function' &&
											block.props.exclude(childNode as Element, settings)
										) {
											// eslint-disable-next-line react/jsx-no-useless-fragment
											return <></>;
										}

										return options.replace(childNode);
									},
							  })
							: null,
					);
				}
			});

			return component;
		},
	};

	return <>{parse(cleanedHTML, options)}</>;
}

/**
 * @internal
 */
// eslint-disable-next-line no-redeclare
export namespace BlocksRenderer {
	export const defaultProps = {
		ksesAllowList: undefined,
	};
}
