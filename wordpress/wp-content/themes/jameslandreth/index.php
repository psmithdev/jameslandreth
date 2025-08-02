<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php wp_title('|', true, 'right'); ?><?php bloginfo('name'); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<header class="site-header">
    <div class="header-container">
        <h1 class="site-title">JAMES LANDRETH</h1>
        <form class="search-form" role="search" method="get" action="<?php echo home_url('/'); ?>">
            <input type="search" placeholder="Search" value="<?php echo get_search_query(); ?>" name="s">
            <button type="submit">🔍</button>
        </form>
    </div>
    
    <nav class="main-navigation">
        <ul class="nav-menu">
            <li><a href="<?php echo home_url('/'); ?>">About Me</a></li>
            <li><a href="#">Annual Adventures</a></li>
            <li><a href="#">Essays</a></li>
            <li><a href="#">Family History</a></li>
            <li><a href="#">Favorite Cartoons</a></li>
            <li><a href="#">Inventory</a></li>
            <li><a href="#">Loretto Perfectus</a></li>
            <li><a href="#">Music</a></li>
            <li><a href="#">Photos</a></li>
            <li><a href="#">Travels ⌄</a></li>
        </ul>
    </nav>
</header>

<main class="site-main">
    <div class="main-content">
        
        <!-- Latest Section -->
        <section class="content-section">
            <h2 class="section-title">Latest</h2>
            <div class="posts-grid">
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">If ties could talk part 1 test</a></h3>
                    <div class="post-author">if-ties-could-talk-no1Download<br>Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">This is my title</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">If ties</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">Perils of Pauline Part 2</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">The Perils of Pauline</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
            </div>
        </section>

        <!-- Trending Section -->
        <section class="content-section">
            <h2 class="section-title">Trending</h2>
            <div class="posts-grid">
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">If ties could talk part 1 test</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">This is my title</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">If ties</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
                
                <article class="post-item">
                    <div class="post-category">Uncategorized</div>
                    <h3 class="post-title"><a href="#">Perils of Pauline Part 2</a></h3>
                    <div class="post-author">Aleda Littlefield</div>
                </article>
            </div>
        </section>
    </div>

    <aside class="sidebar">
        <div class="widget">
            <h3>Subscribe</h3>
            <p>Get the latest updates</p>
            <form class="newsletter-form">
                <input type="email" placeholder="Enter email">
                <button type="submit">Subscribe</button>
            </form>
        </div>
    </aside>
</main>

<!-- Archives Section -->
<section class="archives-section">
    <h2 class="section-title">Archives</h2>
    <div class="archives-categories">
        <span>Health</span><span>Fashion</span><span>Food</span><span>Shopping</span><span>Events</span><span>Fiction</span><span>Travel</span><span>Japan</span><span>Education</span>
    </div>
</section>

<!-- Newsletter Section -->
<section class="newsletter-section">
    <h3>James celebrates the very best in independent journalism. Through the online content we publish, we share our opinions and thoughts on the various problems that the world is facing right now.</h3>
    <p>Subscribe to our newsletters. We'll keep you in the loop.</p>
    <form class="newsletter-form">
        <input type="email" placeholder="Type your email...">
        <button type="submit">→</button>
    </form>
</section>

<footer class="site-footer">
    <nav class="footer-nav">
        <a href="#">About Me</a>
        <a href="#">Annual Adventures</a>
        <a href="#">Essays</a>
        <a href="#">Family History</a>
        <a href="#">Favorite Cartoons</a>
        <a href="#">Inventory</a>
        <a href="#">Loretto Perfectus</a>
        <a href="#">Music</a>
        <a href="#">Photos</a>
        <a href="#">Travels ⌄</a>
    </nav>
    <div class="social-links">
        <!-- Social media icons would go here -->
    </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>