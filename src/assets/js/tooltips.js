/**
 * Jargon tooltips
 * Walks .article-content text nodes and wraps any matched acronym/term with a
 * <span class="tooltip-term" data-tooltip="...">. Hover/focus reveals the
 * expansion via CSS. Word-boundary regex (with manual boundaries for the
 * occasional `&` or digit) prevents matches inside other words.
 *
 * Add new entries to the `terms` map below. Empty by default — populate as
 * jargon comes up in posts. Plain {KEY: EXPANSION} object.
 */
(function () {
  'use strict';

  var terms = {
    // Web tech
    'PageSpeed': 'Google PageSpeed Insights: a tool that scores your site’s mobile and desktop performance.',
    'PSI': 'PageSpeed Insights: Google’s public web performance audit tool.',
    'LCP': 'Largest Contentful Paint: how long until the biggest above-the-fold element renders.',
    'CLS': 'Cumulative Layout Shift: how much the page jumps around as it loads.',
    'INP': 'Interaction to Next Paint: how quickly the page responds to user input.',
    'FID': 'First Input Delay: replaced by INP in March 2024.',
    'TTFB': 'Time to First Byte: how long the server takes to send the first byte of a response.',
    'CDN': 'Content Delivery Network: a network of edge servers that caches your site close to users.',
    'CMS': 'Content Management System: WordPress, Squarespace, etc. — software that lets non-developers edit a site.',
    'DNS': 'Domain Name System: turns yourbusiness.com into the IP address your visitor’s browser actually dials.',
    'SSL': 'Secure Sockets Layer: the certificate that turns http:// into https://.',
    'HSTS': 'HTTP Strict Transport Security: a header that tells browsers to refuse non-HTTPS connections.',
    'WCAG': 'Web Content Accessibility Guidelines: the international accessibility standard.',
    'ADA': 'Americans with Disabilities Act: U.S. law covering accessibility, including websites.',
    'SEO': 'Search Engine Optimization: practices that improve how a site ranks in Google and Bing.',
    'GBP': 'Google Business Profile: your business’s listing on Google Maps and Search.',
    'SLA': 'Service Level Agreement: a written commitment to response times or uptime.'
  };

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    var keys = Object.keys(terms);
    if (!keys.length) return;
    var root = document.querySelector('.article-content');
    if (!root) root = document.querySelector('main');
    if (!root || root.dataset.tooltipsInitialized === 'true') return;
    root.dataset.tooltipsInitialized = 'true';

    // Build one combined regex with named capture for each key.
    var pattern = keys.map(escapeRegExp).join('|');
    var combined = new RegExp('\\b(' + pattern + ')\\b', 'g');

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' || tag === 'A') return NodeFilter.FILTER_REJECT;
        if (p.classList && (p.classList.contains('tooltip-term') || p.closest && p.closest('.tooltip-term'))) return NodeFilter.FILTER_REJECT;
        if (!combined.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        combined.lastIndex = 0;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(function (node) {
      var html = node.nodeValue.replace(combined, function (_match, key) {
        var desc = terms[key] || terms[Object.keys(terms).find(function (k) { return k.toLowerCase() === key.toLowerCase(); })];
        if (!desc) return key;
        return '<span class="tooltip-term" data-tooltip="' + escapeHtml(desc) + '" tabindex="0">' + escapeHtml(key) + '</span>';
      });
      if (html === node.nodeValue) return;
      var wrap = document.createElement('span');
      wrap.innerHTML = html;
      node.parentNode.replaceChild(wrap, node);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.uicInitTooltips = init;
})();
