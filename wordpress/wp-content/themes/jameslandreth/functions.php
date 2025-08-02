<?php
/**
 * James Landreth Theme Functions
 */

// Enqueue styles and scripts
function jameslandreth_enqueue_styles() {
    wp_enqueue_style('jameslandreth-style', get_stylesheet_uri());
}
add_action('wp_enqueue_scripts', 'jameslandreth_enqueue_styles');

// Theme support
function jameslandreth_theme_support() {
    // Add theme support for post thumbnails
    add_theme_support('post-thumbnails');
    
    // Add theme support for title tag
    add_theme_support('title-tag');
    
    // Add theme support for custom logo
    add_theme_support('custom-logo');
    
    // Add theme support for menus
    add_theme_support('menus');
}
add_action('after_setup_theme', 'jameslandreth_theme_support');

// Register navigation menus
function jameslandreth_register_menus() {
    register_nav_menus(array(
        'primary' => __('Primary Menu'),
        'footer' => __('Footer Menu'),
    ));
}
add_action('init', 'jameslandreth_register_menus');

// Register sidebar
function jameslandreth_widgets_init() {
    register_sidebar(array(
        'name'          => __('Primary Sidebar'),
        'id'            => 'sidebar-1',
        'description'   => __('Add widgets here to appear in your sidebar.'),
        'before_widget' => '<div class="widget">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));
}
add_action('widgets_init', 'jameslandreth_widgets_init');

// Custom post excerpt length
function jameslandreth_excerpt_length($length) {
    return 20;
}
add_filter('excerpt_length', 'jameslandreth_excerpt_length');

// Custom excerpt more
function jameslandreth_excerpt_more($more) {
    return '...';
}
add_filter('excerpt_more', 'jameslandreth_excerpt_more');
?>