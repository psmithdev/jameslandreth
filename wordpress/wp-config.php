<?php
/**
 * Basic WordPress configuration for theme development
 */

// Database settings (dummy - for theme preview only)
define( 'DB_NAME', 'wordpress' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

// Authentication unique keys and salts
define( 'AUTH_KEY',         'dev-auth-key' );
define( 'SECURE_AUTH_KEY',  'dev-secure-key' );
define( 'LOGGED_IN_KEY',    'dev-logged-key' );
define( 'NONCE_KEY',        'dev-nonce-key' );
define( 'AUTH_SALT',        'dev-auth-salt' );
define( 'SECURE_AUTH_SALT', 'dev-secure-salt' );
define( 'LOGGED_IN_SALT',   'dev-logged-salt' );
define( 'NONCE_SALT',       'dev-nonce-salt' );

// WordPress Database Table prefix
$table_prefix = 'wp_';

// WordPress debugging mode
define( 'WP_DEBUG', false );

// Skip database connection for theme preview
define( 'WP_INSTALLING', true );

// Set the current theme
define( 'WP_DEFAULT_THEME', 'jameslandreth' );

/* That's all, stop editing! Happy publishing. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';