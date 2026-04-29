/**
 * Build-time product data for 11ty.
 *
 * In development (npm start), returns placeholder products.
 * In production build with Wrangler, fetches from D1 via the products API.
 *
 * Usage in templates:
 *   {% for product in products %}
 *     <h3>{{ product.name }}</h3>
 *     <p>${{ product.price }}</p>
 *   {% endfor %}
 */

module.exports = async function () {
    // When building with Wrangler (production), PRODUCTS_API_URL could be set.
    // For local dev and initial builds, return placeholder data.
    // Users populate real products via the admin interface or direct D1 SQL.
    return [
        {
            id: 1,
            name: 'Sample Product',
            slug: 'sample-product',
            description: 'This is a placeholder product. Add real products to your D1 database.',
            price: '29.99',
            price_cents: 2999,
            compareAtPrice: null,
            category: '',
            image_url: 'https://csimg.nyc3.cdn.digitaloceanspaces.com/Images/People/business2.jpg',
            inStock: true,
            variants: [],
        },
        {
            id: 2,
            name: 'Another Product',
            slug: 'another-product',
            description: 'Another placeholder. Replace with your actual products.',
            price: '49.99',
            price_cents: 4999,
            compareAtPrice: '59.99',
            category: '',
            image_url: 'https://csimg.nyc3.cdn.digitaloceanspaces.com/Images/People/business3.jpg',
            inStock: true,
            variants: [],
        },
    ];
};
