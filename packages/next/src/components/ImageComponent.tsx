import Image from 'next/image';

import { ImageBlockProps } from '@10up/headless-core/react';

/**
 * An implementation of the ImageBlock (core/image).
 *
 * If `width`, `height` or `src` are not provided, this component will not be used.
 *
 * ## Usage
 *
 * ```tsx
 * import { BlocksRenderer, ImageBlock } from "@10up/headless-core/react";
 * import { ImageComponent } from "@10up/headless-next";
 *
 * <BlocksRenderer html={html}>
 * 	<ImageBlock component={ImageComponent} />
 * </BlocksRenderer>
 * ```
 *
 * @param props {@link ImageBlockProps}
 *
 * @category React Components
 */
export function ImageComponent({ src, alt, width, height, children }: ImageBlockProps) {
	if (!width || !height) {
		return children;
	}
	if (!src) {
		return children;
	}

	return <Image src={src} alt={alt} width={width} height={height} layout="intrinsic" />;
}