/**
 * Table of Contents Generator
 * - Extracts h2 headers from article content
 * - Generates TOC navigation (desktop sidebar + mobile horizontal scroller)
 * - Highlights current section on scroll
 */
document.addEventListener('DOMContentLoaded', function() {
    const articleContent = document.querySelector('.article-content');
    if (!articleContent) return;

    const mainHeaders = articleContent.querySelectorAll('h2');
    const sectionHeaders = document.querySelectorAll('[data-toc-section] h2');
    const headers = [...mainHeaders, ...sectionHeaders];

    if (headers.length < 2) {
        document.querySelector('.toc-sidebar')?.remove();
        document.querySelector('.toc-mobile')?.remove();
        return;
    }

    const tocItems = [];
    headers.forEach((header, i) => {
        const text = header.textContent.replace(/<[^>]*>/g, '').trim();
        const id = 'section-' + (i + 1);
        header.id = id;
        const displayText = text.length > 35 ? text.slice(0, 35) + '...' : text;
        tocItems.push({ id, text: displayText });
    });

    const tocList = document.querySelector('.toc-list');
    if (tocList) {
        tocItems.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + item.id;
            a.textContent = item.text;
            li.appendChild(a);
            tocList.appendChild(li);
        });
    }

    const tocMobile = document.querySelector('.toc-mobile');
    if (tocMobile) {
        tocItems.forEach(item => {
            const a = document.createElement('a');
            a.href = '#' + item.id;
            a.className = 'toc-chip';
            a.textContent = item.text;
            tocMobile.appendChild(a);
        });
    }

    const observerOptions = {
        root: null,
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                document.querySelectorAll('.toc-list a, .toc-chip').forEach(a => {
                    a.classList.toggle('active', a.getAttribute('href') === '#' + id);
                });
                if (tocMobile) {
                    const activeChip = tocMobile.querySelector('.active');
                    if (activeChip) {
                        const containerRect = tocMobile.getBoundingClientRect();
                        const chipRect = activeChip.getBoundingClientRect();
                        const scrollLeft = tocMobile.scrollLeft + (chipRect.left - containerRect.left) - (containerRect.width / 2) + (chipRect.width / 2);
                        tocMobile.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                    }
                }
            }
        });
    }, observerOptions);

    headers.forEach(header => observer.observe(header));

    window.addEventListener('scroll', function() {
        if (window.scrollY < 50) {
            document.querySelectorAll('.toc-list a, .toc-chip').forEach(a => {
                a.classList.remove('active');
            });
            if (tocMobile) {
                tocMobile.scrollTo({ left: 0, behavior: 'smooth' });
            }
        }
    }, { passive: true });

    document.querySelectorAll('.toc-list a, .toc-chip').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').slice(1);
            const target = document.getElementById(targetId);
            if (target) {
                const headerOffset = 120;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    });
});
