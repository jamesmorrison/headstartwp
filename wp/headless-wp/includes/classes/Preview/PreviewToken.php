<?php
namespace HeadlessWP\Preview;

use Firebase\JWT\JWT;

/**
 * Class with static methods to generate and parse capability tokens.
 */
class PreviewToken {

  private static $payload = null;

  /**
   * Add actions and filters.
   */
  public static function setup() {
    $payload = PreviewToken::get_payload_from_token();
    PreviewToken::$payload = $payload;

    // Filter that modifies user capabilities during runtime.
    if ( defined( 'REST_REQUEST' ) && REST_REQUEST && $payload ) {
    	add_filter( 'user_has_cap', [ PreviewToken::class, 'user_has_cap' ], 20, 4);
    }
  }

  /**
   * Generate a capability token using the given payload.
   */
  public static function generate( $payload ) {
    // Get the current time to compute issue and expiration time.
    $issued_at = time();

    // Generate payload.
    $payload = array(
      "iat" 			=> $issued_at,
      "exp"       => $issued_at + 5 * MINUTE_IN_SECONDS,
      'type'      => $payload['type'],
      'post_type' => $payload['post_type'],
      'post_id'   => $payload['post_id'],
      'generator' => '10up-headless-wp'
    );

    return JWT::encode($payload, PreviewToken::get_private_key());
  }

  /**
   * Validate a token using args.
   */
  public static function check_capability( $args ) {
    $payload = (array) PreviewToken::$payload;


    // Do not authenticate if the token was not generated by Frontity.
    if ( $payload['generator'] !== '10up-headless-wp' ) return false;
    // Do not authenticate if the token is not for the preview.
    if ( $payload['type'] !== 'preview' ) return false;
    // Prevent using the token for requests that are not GET.
    if ( isset( $_SERVER['REQUEST_METHOD'] ) && $_SERVER['REQUEST_METHOD'] !== "GET" ) return false;
    // Prevent using the token for requests that are GET, but use the
    // `_method` query to override the method.
    if ( isset( $_GET['_method'] ) && $_GET[ '_method' ] !== "GET" ) return false;
    // Prevent using the token for requests that are GET, but use the
    // `X-HTTP-Method-Override` header to override the method.
    if ( isset( $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ) && $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] !== "GET" ) return false;

    $post_id = $payload['post_id'];
    $post_type = $payload['post_type'];

    // Allowed capabilites when the token is type 'preview'. You also need to
    // have permission to 'edit_post' or 'delete_post' for preview posts.
    $capabilities = array(
      'read_post'   => $post_id,
      'edit_post'   => $post_id,
      'delete_post' => $post_id,
    );

    // Prior to WordPress 5.5.1, capabilities should be specified with `page`
    // for pages, so we are adding them as well to support older versions of
    // WordPress.
    if ( $post_type === 'page' ) {
      $capabilities = array_merge( $capabilities, array(
        "read_page"   => $post_id,
        "edit_page"   => $post_id,
        "delete_page" => $post_id,
      ) );
    }

    // Use key-value to check capabilities with an associated ID.
    if ( count( $args ) === 3 ) {
      // Get capability and ID.
      list( $cap, $_, $id ) = $args;
      // Find that capability in the capabilities array.
      return isset( $capabilities[ $cap ] ) && $capabilities[ $cap ] === $id;
    }

    // If it is a global capability, check if it is included as value.
    list( $cap ) = $args;
    return in_array( $cap, $capabilities );
  }

  /**
   * Modify user capabilities on run time.
   */
  public static function user_has_cap( $allcaps, $caps, $args, $user ) {
    // Add capability if it is allowed in the token.
    if ( PreviewToken::check_capability( $args )) {
      foreach ( $caps as $cap ) {
        $allcaps[ $cap ] = true;
      }
    }

    // Return capabilities.
    return $allcaps;
  }

  /**
   * Return the private key used to encode and decode tokens.
   */
  private static function get_private_key() {
    if ( defined( '10UP_HEADLESS_JWT_AUTH_KEY' ) ) {
			return TENUP_HEADLESS_JWT_AUTH_KEY;
		}

    if ( defined( 'SECURE_AUTH_KEY' ) ) {
			return SECURE_AUTH_KEY;
		}

    // No secure auth key found. Throw an error.
    $error = new \WP_Error(
      'no-secure-auth-key',
      'Please define either SECURE_AUTH_KEY or TENUP_HEADLESS_JWT_AUTH_KEY in your wp-config.php file.'
    );

    throw new \Exception( $error->get_error_message() );
  }

  /**
   * Decode capability tokens if present.
   */
  private static function get_payload_from_token() {
		// Get HTTP Authorization Header.
    $header = isset( $_SERVER['HTTP_AUTHORIZATION'] )
      ? sanitize_text_field( $_SERVER['HTTP_AUTHORIZATION'] )
      : false;

		// Check for alternative header.
		if ( ! $header && isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$header = sanitize_text_field( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] );
    }

    // No Authorization Header is present.
    if ( ! $header ) return null;

    // Get and parse the token.
    try {
      list( $token ) = sscanf( $header, 'Bearer %s' );
      $payload = JWT::decode(
        $token,
        PreviewToken::get_private_key(),
        array('HS256')
      );
    } catch (\Exception $e) {
      // Token is not valid.
      return null;
    }

    // Return the parsed token.
		return $payload;
  }
}
