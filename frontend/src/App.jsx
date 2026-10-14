import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  CartProvider,
  useCart,
} from './contexts/CartContext';

import API
  from './api/axios';

import Header
  from './components/Header';

import Hero
  from './components/Hero';

import EnhancedBackground
  from './components/EnhancedBackground';

import FloatingParticles
  from './components/FloatingParticles';

import ProductsGrid
  from './components/ProductsGrid';

import BottleGrid
  from './components/BottleGrid';

import ScentNotes
  from './components/ScentNotes';

import AIFragranceFinder
  from './components/AIFragranceFinder';

import Testimonials
  from './components/Testimonials';

import About
  from './components/About';

import Philosophy
  from './components/Philosophy';

import PersonalizedSection
  from './components/PersonalizedSection';

import Contact
  from './components/Contact';

import Footer
  from './components/Footer';

import CartSidebar
  from './components/CartSidebar';

import WishlistSidebar
  from './components/WishlistSidebar';

import ProductModal
  from './components/ProductModal';

/* ========================================
   IMAGE HELPER
======================================== */

const normalizeImageUrl = (
  url
) => {
  if (!url) {
    return null;
  }

  if (
    typeof url ===
    'object'
  ) {
    url =
      url.url ||
      url.secure_url ||
      url.path ||
      url.src ||
      '';
  }

  if (
    typeof url !==
      'string' ||
    !url.trim()
  ) {
    return null;
  }

  const cleanUrl =
    url.trim();

  if (
    cleanUrl.startsWith(
      'http://'
    ) ||
    cleanUrl.startsWith(
      'https://'
    ) ||
    cleanUrl.startsWith(
      'data:'
    ) ||
    cleanUrl.startsWith(
      'blob:'
    )
  ) {
    return cleanUrl;
  }

  const baseUrl =
    (
      import.meta.env
        .VITE_API_URL ||
      'https://perfume-stock-management-system-ewa.vercel.app'
    ).replace(
      /\/$/,
      ''
    );

  return `${baseUrl}${
    cleanUrl.startsWith(
      '/'
    )
      ? ''
      : '/'
  }${cleanUrl}`;
};

const normalizeBottleImages = (
  images
) => {
  if (
    !Array.isArray(
      images
    )
  ) {
    return [];
  }

  return images
    .map(
      (
        image
      ) =>
        normalizeImageUrl(
          image
        )
    )
    .filter(
      Boolean
    );
};

/* ========================================
   APP CONTENT
======================================== */

const AppContent = () => {
  const {
    addToCart,
  } = useCart();

  /* ======================================
     PRODUCTS
  ====================================== */

  const [
    productsList,
    setProductsList,
  ] = useState([]);

  const [
    productsLoading,
    setProductsLoading,
  ] = useState(true);

  /* ======================================
     BOTTLES
  ====================================== */

  const [
    bottlesList,
    setBottlesList,
  ] = useState([]);

  const [
    bottlesLoading,
    setBottlesLoading,
  ] = useState(true);

  const [
    bottlesError,
    setBottlesError,
  ] = useState('');

  /* ======================================
     WISHLIST
  ====================================== */

  const [
    wishlist,
    setWishlist,
  ] = useState([]);

  /* ======================================
     UI
  ====================================== */

  const [
    isCartOpen,
    setIsCartOpen,
  ] = useState(false);

  const [
    isWishlistOpen,
    setIsWishlistOpen,
  ] = useState(false);

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState(null);

  /* ======================================
     WISHLIST STORAGE
  ====================================== */

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          'storeWishlist'
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(
          saved
        );

      if (
        Array.isArray(
          parsed
        )
      ) {
        setWishlist(
          parsed
        );
      }
    } catch (error) {
      console.error(
        'Wishlist load error:',
        error
      );
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'storeWishlist',
        JSON.stringify(
          wishlist
        )
      );
    } catch (error) {
      console.error(
        'Wishlist save error:',
        error
      );
    }
  }, [
    wishlist,
  ]);

  /* ======================================
     FETCH PRODUCTS
  ====================================== */

  useEffect(() => {
    const fetchProducts =
      async () => {
        try {
          setProductsLoading(
            true
          );

          const response =
            await API.get(
              '/products?showOnClient=true&limit=10000'
            );

          let raw = [];

          if (
            Array.isArray(
              response.data
            )
          ) {
            raw =
              response.data;
          } else if (
            Array.isArray(
              response.data
                ?.products
            )
          ) {
            raw =
              response.data
                .products;
          } else if (
            Array.isArray(
              response.data
                ?.data
            )
          ) {
            raw =
              response.data
                .data;
          } else if (
            Array.isArray(
              response.data
                ?.items
            )
          ) {
            raw =
              response.data
                .items;
          }

          const transformed =
            raw
              .filter(
                (
                  product
                ) =>
                  product &&
                  product._id
              )
              .map(
                (
                  product
                ) => {
                  const isSpray =
                    product.type ===
                    'spray';

                  const category =
                    isSpray
                      ? 'perfume'
                      : 'oil';

                  const validSizes =
                    (
                      product.sizes ||
                      []
                    ).filter(
                      (
                        size
                      ) =>
                        Number(
                          size.sizeMl
                        ) !== 3
                    );

                  const prices =
                    validSizes
                      .map(
                        (
                          size
                        ) =>
                          Number(
                            size.sellingPrice
                          )
                      )
                      .filter(
                        (
                          price
                        ) =>
                          Number.isFinite(
                            price
                          ) &&
                          price >
                            0
                      );

                  const basePrice =
                    prices.length
                      ? Math.min(
                          ...prices
                        )
                      : 0;

                  const notes =
                    product.notes
                      ?.length
                      ? product.notes
                      : (
                          product
                            .blendComponents ||
                          []
                        )
                          .map(
                            (
                              component
                            ) =>
                              component
                                .material
                                ?.name ||
                              ''
                          )
                          .filter(
                            Boolean
                          );

                  const isNew =
                    product.createdAt &&
                    Date.now() -
                      new Date(
                        product.createdAt
                      ).getTime() <
                      30 *
                        24 *
                        60 *
                        60 *
                        1000;

                  let mainImage =
                    null;

                  if (
                    product.images
                      ?.length
                  ) {
                    mainImage =
                      normalizeImageUrl(
                        product
                          .images[0]
                      );
                  } else if (
                    validSizes[0]
                      ?.image
                  ) {
                    mainImage =
                      normalizeImageUrl(
                        validSizes[0]
                          .image
                      );
                  }

                  return {
                    id:
                      product._id,

                    name:
                      product.name,

                    sku:
                      product.sku,

                    category,

                    type:
                      product.type,

                    description:
                      product.description ||
                      `${product.name} – ${product.sku}`,

                    basePrice,

                    notes:
                      notes.length
                        ? notes
                        : [
                            'Premium',
                          ],

                    intensity:
                      product.intensity ||
                      (
                        isSpray
                          ? 'medium'
                          : 'strong'
                      ),

                    bestFor:
                      product.bestFor ||
                      [
                        'all',
                      ],

                    isNew,

                    isBestseller:
                      Boolean(
                        product.isBestseller
                      ),

                    isStockOut:
                      Boolean(
                        product.isStockOut
                      ),

                    images:
                      Array.isArray(
                        product.images
                      )
                        ? product.images
                        : [],

                    mainImage,

                    backendData:
                      product,

                    sizes:
                      validSizes,
                  };
                }
              )
              .filter(
                (
                  product
                ) =>
                  product.sizes
                    .length >
                  0
              );

          setProductsList(
            transformed
          );
        } catch (error) {
          console.error(
            'Product fetch error:',
            error
          );

          setProductsList(
            []
          );
        } finally {
          setProductsLoading(
            false
          );
        }
      };

    fetchProducts();
  }, []);

  /* ======================================
     FETCH BOTTLES
  ====================================== */

  useEffect(() => {
    const fetchBottles =
      async () => {
        try {
          setBottlesLoading(
            true
          );

          setBottlesError(
            ''
          );

          const {
            data,
          } =
            await API.get(
              '/inventory/bottles/public'
            );

          console.log(
            'PUBLIC BOTTLES:',
            data
          );

          const raw =
            Array.isArray(
              data
            )
              ? data
              : Array.isArray(
                    data?.bottles
                  )
                ? data.bottles
                : Array.isArray(
                      data?.data
                    )
                  ? data.data
                  : [];

          const normalized =
            raw
              .filter(
                (
                  bottle
                ) =>
                  bottle &&
                  bottle._id
              )
              .map(
                (
                  bottle
                ) => {
                  const images =
                    normalizeBottleImages(
                      bottle.images
                    );

                  return {
                    ...bottle,

                    id:
                      bottle._id,

                    sizeMl:
                      Number(
                        bottle.sizeMl ||
                        0
                      ),

                    currentStock:
                      Number(
                        bottle.currentStock ||
                        0
                      ),

                    sellingPrice:
                      Number(
                        bottle.sellingPrice ||
                        0
                      ),

                    images,

                    mainImage:
                      images[0] ||
                      null,

                    isStockOut:
                      Boolean(
                        bottle.isStockOut
                      ),
                  };
                }
              )
              .sort(
                (
                  a,
                  b
                ) => {
                  const order = {
                    spray: 0,
                    'roll-on': 1,
                  };

                  const first =
                    order[
                      a.type
                    ] ??
                    99;

                  const second =
                    order[
                      b.type
                    ] ??
                    99;

                  if (
                    first !==
                    second
                  ) {
                    return (
                      first -
                      second
                    );
                  }

                  return (
                    a.sizeMl -
                    b.sizeMl
                  );
                }
              );

          console.log(
            'NORMALIZED BOTTLES:',
            normalized
          );

          setBottlesList(
            normalized
          );
        } catch (error) {
          console.error(
            'Bottle fetch error:',
            error.response
              ?.status,
            error.response
              ?.data,
            error
          );

          setBottlesError(
            error.response
              ?.data
              ?.message ||
            'Unable to load bottles.'
          );

          setBottlesList(
            []
          );
        } finally {
          setBottlesLoading(
            false
          );
        }
      };

    fetchBottles();
  }, []);

  /* ======================================
     WISHLIST
  ====================================== */

  const toggleWishlist =
    useCallback(
      (
        productId
      ) => {
        setWishlist(
          (
            previous
          ) =>
            previous.includes(
              productId
            )
              ? previous.filter(
                  (
                    id
                  ) =>
                    id !==
                    productId
                )
              : [
                  ...previous,
                  productId,
                ]
        );
      },
      []
    );

  const removeFromWishlist =
    useCallback(
      (
        productId
      ) => {
        setWishlist(
          (
            previous
          ) =>
            previous.filter(
              (
                id
              ) =>
                id !==
                productId
            )
        );
      },
      []
    );

  /* ======================================
     PRODUCT MODAL
  ====================================== */

  const openProductModal =
    useCallback(
      (
        product
      ) => {
        setSelectedProduct(
          product
        );
      },
      []
    );

  const closeProductModal =
    useCallback(
      () => {
        setSelectedProduct(
          null
        );
      },
      []
    );

  /* ======================================
     WISHLIST QUICK ADD
  ====================================== */

  const handleWishlistQuickAdd =
    useCallback(
      (
        product
      ) => {
        if (
          !product ||
          product.isStockOut
        ) {
          return;
        }

        const sizes =
          product.sizes ||
          [];

        const available =
          sizes.filter(
            (
              size
            ) =>
              Number(
                size.sellingPrice
              ) >
              0
          );

        if (
          !available.length
        ) {
          return;
        }

        const smallest =
          [
            ...available,
          ].sort(
            (
              a,
              b
            ) =>
              Number(
                a.sizeMl
              ) -
              Number(
                b.sizeMl
              )
          )[0];

        addToCart(
          product,
          smallest,
          1
        );
      },
      [
        addToCart,
      ]
    );

  /* ======================================
     UI
  ====================================== */

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">

      <EnhancedBackground />

      <FloatingParticles
        count={
          30
        }
      />

      <Header
        toggleCart={() =>
          setIsCartOpen(
            true
          )
        }
        wishlist={
          wishlist
        }
        onWishlistClick={() =>
          setIsWishlistOpen(
            true
          )
        }
      />

      <main className="relative z-10">

        <Hero />

        <ProductsGrid
          products={
            productsList
          }
          loading={
            productsLoading
          }
          wishlist={
            wishlist
          }
          toggleWishlist={
            toggleWishlist
          }
          openProductModal={
            openProductModal
          }
        />

        <BottleGrid
          bottles={
            bottlesList
          }
          loading={
            bottlesLoading
          }
          error={
            bottlesError
          }
        />

        <ScentNotes />

        <AIFragranceFinder
          openProductModal={
            openProductModal
          }
        />

        <About />

        <Philosophy />

        <Testimonials />

        <PersonalizedSection />

        <Contact />

      </main>

      <Footer />

      <CartSidebar
        isOpen={
          isCartOpen
        }
        onClose={() =>
          setIsCartOpen(
            false
          )
        }
      />

      <WishlistSidebar
        isOpen={
          isWishlistOpen
        }
        onClose={() =>
          setIsWishlistOpen(
            false
          )
        }
        wishlist={
          wishlist
        }
        products={
          productsList
        }
        onRemove={
          removeFromWishlist
        }
        onViewProduct={
          openProductModal
        }
        onAddToCart={
          handleWishlistQuickAdd
        }
      />

      {selectedProduct && (
        <ProductModal
          product={
            selectedProduct
          }
          onClose={
            closeProductModal
          }
        />
      )}

    </div>
  );
};

/* ========================================
   ROOT
======================================== */

const App = () => {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
};

export default App;