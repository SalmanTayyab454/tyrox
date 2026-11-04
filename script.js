(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll reveals ---------- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = Number(el.getAttribute("data-reveal-delay") || 0);
        window.setTimeout(() => {
          el.classList.add("is-visible");
          if (el.classList.contains("media-reveal")) el.classList.add("is-revealed");
          el.querySelectorAll(".media-reveal").forEach((media) => media.classList.add("is-revealed"));
        }, reduceMotion ? 0 : delay);
        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
  );

  document.querySelectorAll("[data-reveal]").forEach((el) => revealObserver.observe(el));

  /* ---------- Sticky header ---------- */
  const topbar = document.querySelector(".topbar");
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  const headerCta = document.querySelector(".header-cta");

  const onScroll = () => {
    topbar?.classList.toggle("scrolled", window.scrollY > 10);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    nav?.classList.toggle("is-open", !open);
    headerCta?.classList.toggle("is-open", !open);
    document.body.classList.toggle("menu-open", !open);
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle?.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
      headerCta?.classList.remove("is-open");
      document.body.classList.remove("menu-open");
    });
  });

  /* ---------- Live Google stats + one-shot counters ---------- */
  const statsSection = document.querySelector("[data-stats-section]");
  let statsReady = false;
  let statsAnimated = false;

  const formatCount = (value, decimals) => {
    if (decimals > 0) return Number(value).toFixed(decimals);
    const rounded = Math.round(Number(value));
    return rounded >= 1000 ? rounded.toLocaleString("en-US") : String(rounded);
  };

  const animateCount = (el) => {
    if (el.dataset.counted === "true") return;
    el.dataset.counted = "true";
    const target = Number(el.getAttribute("data-count") || 0);
    const decimals = Number(el.getAttribute("data-decimals") || 0);
    const from = Number(el.getAttribute("data-start") || 0);
    if (reduceMotion) {
      el.textContent = formatCount(target, decimals);
      return;
    }
    // Fast snappy count — shorter for small numbers, still quick for large ones
    const span = Math.abs(target - from);
    const duration = span >= 1000 ? 1100 : span >= 20 ? 900 : 700;
    const startTime = performance.now();
    el.textContent = formatCount(from, decimals);
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      // Ease-out expo: races up early, settles on the final number
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const current = from + (target - from) * eased;
      el.textContent = formatCount(current, decimals);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = formatCount(target, decimals);
      }
    };
    requestAnimationFrame(tick);
  };

  const runStatsAnimation = () => {
    if (statsAnimated || !statsReady) return;
    statsAnimated = true;
    statsSection
      ?.querySelectorAll("[data-count]")
      .forEach((el, index) => {
        window.setTimeout(() => animateCount(el), index * 90);
      });
  };

  const applyGoogleStats = (data) => {
    const rating = Number(data.rating || 0);
    const reviews = Number(data.reviews || 0);

    document.querySelectorAll('[data-google="rating"]').forEach((el) => {
      el.setAttribute("data-count", String(rating));
      el.setAttribute("data-decimals", "1");
      if (!statsAnimated) el.textContent = "0.0";
    });
    document.querySelectorAll('[data-google="reviews"]').forEach((el) => {
      el.setAttribute("data-count", String(reviews));
      el.removeAttribute("data-decimals");
      if (!statsAnimated) el.textContent = "0";
    });
    document.querySelectorAll('[data-google-display="rating"]').forEach((el) => {
      el.textContent = rating.toFixed(1);
    });
    document.querySelectorAll('[data-google-display="reviews"]').forEach((el) => {
      el.textContent = String(reviews);
    });

    const stars = document.querySelector("#reviews .stars");
    if (stars) {
      const filled = Math.round(rating);
      stars.textContent = "★".repeat(filled) + "☆".repeat(Math.max(0, 5 - filled));
      stars.setAttribute("aria-label", `${rating.toFixed(1)} out of 5 stars`);
    }
  };

  const loadGoogleStats = async () => {
    try {
      const res = await fetch("/api/google-stats", { cache: "no-store" });
      if (!res.ok) throw new Error("stats unavailable");
      const data = await res.json();
      applyGoogleStats(data);
    } catch (err) {
      // Keep HTML fallbacks (current Google snapshot) if proxy is offline
      console.warn("Live Google stats unavailable, using page defaults.", err);
    } finally {
      statsReady = true;
      if (statsSection?.classList.contains("is-in-view")) runStatsAnimation();
    }
  };

  if (statsSection) {
    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          statsSection.classList.add("is-in-view");
          runStatsAnimation();
          statsObserver.unobserve(statsSection);
        });
      },
      { threshold: 0.35 }
    );
    statsObserver.observe(statsSection);
  }

  loadGoogleStats();

  /* ---------- Hero HQ lazy load + slider (+ deferred video) ---------- */
  const heroRoot = document.querySelector("[data-hero-slider]");
  const markReady = () => {
    document.body.classList.remove("is-booting");
    document.body.classList.add("is-ready");
  };

  const heroAssetExists = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
      window.setTimeout(() => done(false), 2000);
    });

  /** Prefer data-hero-images="1,4,5,6"; otherwise probe hero1.jpg … heroN.jpg */
  const discoverHeroImages = async (max = 12) => {
    const slidesRoot = heroRoot?.querySelector("[data-hero-slides]");
    const declared = (slidesRoot?.getAttribute("data-hero-images") || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (declared.length) return declared.map((n) => ({ n, ext: ".jpg" }));

    const found = await Promise.all(
      Array.from({ length: max }, async (_, i) => {
        const n = i + 1;
        return (await heroAssetExists(`images/hero${n}.jpg`)) ? { n, ext: ".jpg" } : null;
      })
    );
    return found.filter(Boolean);
  };

  const buildHeroImageSlides = (entries) => {
    const slidesRoot = heroRoot?.querySelector("[data-hero-slides]");
    const videoSlide = heroRoot?.querySelector("[data-hero-video]");
    if (!slidesRoot || !entries.length) return;

    // Clear any previously injected image slides (keep video slide)
    [...slidesRoot.querySelectorAll("[data-hero-slide]:not([data-hero-video])")].forEach((el) =>
      el.remove()
    );

    entries.forEach((entry, i) => {
      const n = typeof entry === "number" ? entry : entry.n;
      const ext = typeof entry === "number" ? ".jpg" : entry.ext;
      const src = `images/hero${n}${ext}`;
      const figure = document.createElement("figure");
      figure.className = `hero-slide${i === 0 ? " is-active" : ""}`;
      figure.setAttribute("data-hero-slide", "");
      figure.innerHTML = `
        <img class="hero-lqip" src="images/hero${n}-lqip.jpg" alt="" width="640" height="360" onerror="this.remove()" />
        <img class="hero-photo" data-src="${src}" alt="" width="3840" height="2160" decoding="async"${
          i > 0 ? ' loading="lazy"' : ""
        } />
      `;
      if (videoSlide) slidesRoot.insertBefore(figure, videoSlide);
      else slidesRoot.appendChild(figure);
    });
  };

  const loadHeroSlide = (slide) =>
    new Promise((resolve) => {
      if (!slide || slide.classList.contains("is-loaded")) {
        resolve(slide);
        return;
      }
      if (slide.hasAttribute("data-hero-video")) {
        slide.classList.add("is-loaded");
        resolve(slide);
        return;
      }
      const photo = slide.querySelector(".hero-photo");
      const src = photo?.getAttribute("data-src");
      if (!photo || !src) {
        slide.classList.add("is-loaded");
        resolve(slide);
        return;
      }
      const finish = () => {
        requestAnimationFrame(() => {
          slide.classList.add("is-loaded");
          resolve(slide);
        });
      };
      photo.addEventListener("load", finish, { once: true });
      photo.addEventListener("error", finish, { once: true });
      photo.src = src;
      photo.removeAttribute("data-src");
      if (photo.complete) finish();
    });

  if (heroRoot) {
    const dotsWrap = heroRoot.querySelector("[data-hero-dots]");
    const prev = heroRoot.querySelector(".hero-prev");
    const next = heroRoot.querySelector(".hero-next");
    const videoSlide = heroRoot.querySelector("[data-hero-video]");
    let index = 0;
    let timer;
    let started = false;
    let videoReady = false;

    const getSlides = () =>
      [...heroRoot.querySelectorAll("[data-hero-slide]")].filter(
        (slide) => !slide.hasAttribute("hidden")
      );

    const pauseAllHeroVideos = () => {
      heroRoot.querySelectorAll(".hero-video").forEach((video) => {
        try {
          video.pause();
        } catch (_) {
          /* ignore */
        }
      });
    };

    const playActiveVideo = () => {
      const active = getSlides()[index];
      if (!active?.hasAttribute("data-hero-video") || !videoReady || reduceMotion) return;
      const video = active.querySelector(".hero-video");
      if (!video) return;
      const play = video.play();
      if (play?.catch) play.catch(() => {});
    };

    const renderDots = () => {
      if (!dotsWrap) return;
      const slides = getSlides();
      dotsWrap.innerHTML = slides
        .map((_, i) => {
          const isVideo = slides[i].hasAttribute("data-hero-video");
          const label = isVideo ? "Show hero video" : `Show hero image ${i + 1}`;
          return `<button type="button" aria-label="${label}" ${
            i === index ? 'class="is-active"' : ""
          }></button>`;
        })
        .join("");
      [...dotsWrap.children].forEach((dot, i) => {
        dot.addEventListener("click", () => go(i));
      });
    };

    const go = async (nextIndex) => {
      const slides = getSlides();
      if (!slides.length) return;
      pauseAllHeroVideos();
      const next = ((nextIndex % slides.length) + slides.length) % slides.length;
      if (next === index && slides[next]?.classList.contains("is-active")) {
        restart();
        return;
      }

      // Prefetch next image fully before crossfading so the fade never hits a blank frame
      await loadHeroSlide(slides[next]);
      loadHeroSlide(slides[(next + 1) % slides.length]);

      const prev = slides[index];
      index = next;
      slides.forEach((slide, i) => {
        slide.classList.toggle("is-active", i === index);
        slide.classList.toggle("is-leaving", slide === prev && i !== index);
      });
      window.setTimeout(() => {
        prev?.classList.remove("is-leaving");
      }, 1900);

      renderDots();
      playActiveVideo();
      restart();
    };

    const restart = () => {
      clearInterval(timer);
      if (reduceMotion || !started) return;
      const active = getSlides()[index];
      const dwell = active?.hasAttribute("data-hero-video") ? 12000 : 7000;
      timer = setInterval(() => go(index + 1), dwell);
    };

    const enableHeroVideo = () => {
      if (!videoSlide || reduceMotion || videoReady) return;
      const video = videoSlide.querySelector(".hero-video");
      if (!video) return;

      const mp4 = video.getAttribute("data-src-mp4");
      const webm = video.getAttribute("data-src-webm");
      if (!mp4 && !webm) return;

      // Probe the preferred file first so a missing optional .webm doesn't block .mp4
      const candidates = [mp4, webm].filter(Boolean);

      const tryEnable = async () => {
        let chosen = null;
        for (const url of candidates) {
          try {
            const res = await fetch(url, { method: "HEAD", cache: "no-store" });
            if (res.ok) {
              chosen = url;
              break;
            }
          } catch (_) {
            /* try next */
          }
        }
        if (!chosen) return;

        video.textContent = "";
        const source = document.createElement("source");
        source.src = chosen;
        source.type = chosen.endsWith(".webm") ? "video/webm" : "video/mp4";
        video.appendChild(source);

        const markVideoReady = () => {
          if (videoReady) return;
          videoReady = true;
          videoSlide.removeAttribute("hidden");
          videoSlide.classList.add("is-loaded", "is-video-ready");
          renderDots();
          if (started) restart();
        };

        video.addEventListener("loadeddata", markVideoReady, { once: true });
        video.addEventListener("canplay", markVideoReady, { once: true });
        video.load();
      };

      tryEnable();
    };

    prev?.addEventListener("click", () => go(index - 1));
    next?.addEventListener("click", () => go(index + 1));

    const startHero = async () => {
      const heroEntries = await discoverHeroImages(40);
      buildHeroImageSlides(heroEntries.length ? heroEntries : [1]);

      // LQIP first → HQ blur-up → elegant text cascade
      const slides = getSlides();
      await loadHeroSlide(slides[0]);
      renderDots();
      // Prefetch the rest so every slide is ready when dotted/arrowed
      slides.slice(1).forEach((slide, i) => {
        window.setTimeout(() => loadHeroSlide(slide), 120 * (i + 1));
      });
      if (reduceMotion) {
        markReady();
        started = true;
        go(0);
        return;
      }
      window.setTimeout(() => {
        markReady();
        started = true;
        restart();
      }, 280);
    };

    startHero();

    // Video only mounts after the full page (images, CSS, fonts) has loaded
    const onSiteFullyLoaded = () => {
      window.setTimeout(enableHeroVideo, 250);
    };
    if (document.readyState === "complete") onSiteFullyLoaded();
    else window.addEventListener("load", onSiteFullyLoaded, { once: true });
  } else {
    markReady();
  }

  /* ---------- Lazy-load below-fold images with reveal ---------- */
  document.querySelectorAll("img[loading='lazy']").forEach((img) => {
    if (img.closest(".hero-slide")) return;
    img.classList.add("lazy-img");
    const reveal = () => img.classList.add("is-lazy-shown");
    if (img.complete) {
      reveal();
      return;
    }
    img.addEventListener("load", reveal, { once: true });
  });

  /* ---------- Shared carousel helper ---------- */
  const createCarousel = ({
    trackSelector,
    sliderSelector,
    dotsSelector,
    prevSelector,
    nextSelector,
    cardSelector,
  }) => {
    const track = document.querySelector(trackSelector);
    const slider = document.querySelector(sliderSelector);
    const dots = document.querySelector(dotsSelector);
    const prev = document.querySelector(prevSelector);
    const next = document.querySelector(nextSelector);
    if (!track || !slider) return;

    let page = 0;
    const cards = () => [...track.querySelectorAll(cardSelector)];
    const gap = 20;

    const perPage = () => {
      const first = cards()[0];
      if (!first) return 1;
      const cardWidth = first.getBoundingClientRect().width + gap;
      return Math.max(1, Math.floor((slider.clientWidth + gap) / cardWidth));
    };

    const pageCount = () => Math.max(1, Math.ceil(cards().length / perPage()));

    const updateArrows = () => {
      const total = pageCount();
      const atStart = page <= 0;
      const atEnd = page >= total - 1;
      if (prev) {
        prev.hidden = atStart;
        prev.setAttribute("aria-disabled", String(atStart));
      }
      if (next) {
        next.hidden = atEnd;
        next.setAttribute("aria-disabled", String(atEnd));
      }
    };

    const renderDots = () => {
      if (!dots) return;
      const total = pageCount();
      dots.innerHTML = Array.from({ length: total }, (_, i) => {
        return `<button type="button" aria-label="Slide ${i + 1}" ${
          i === page ? 'class="is-active"' : ""
        }></button>`;
      }).join("");
      [...dots.children].forEach((dot, i) => {
        dot.addEventListener("click", () => go(i));
      });
    };

    const go = (nextPage) => {
      const total = pageCount();
      page = Math.max(0, Math.min(total - 1, nextPage));
      const first = cards()[0];
      if (!first) return;
      const step = (first.getBoundingClientRect().width + gap) * perPage();
      track.style.transform = `translateX(${-page * step}px)`;
      renderDots();
      updateArrows();
    };

    prev?.addEventListener("click", () => {
      if (page > 0) go(page - 1);
    });
    next?.addEventListener("click", () => {
      if (page < pageCount() - 1) go(page + 1);
    });
    window.addEventListener("resize", () => go(Math.min(page, pageCount() - 1)));
    go(0);
  };

  createCarousel({
    trackSelector: "[data-doctor-track]",
    sliderSelector: "[data-doctor-slider]",
    dotsSelector: "[data-doctor-dots]",
    prevSelector: "[data-doctor-prev]",
    nextSelector: "[data-doctor-next]",
    cardSelector: ".doctor-card",
  });

  createCarousel({
    trackSelector: "[data-review-track]",
    sliderSelector: "[data-review-slider]",
    dotsSelector: "[data-review-dots]",
    prevSelector: "[data-review-prev]",
    nextSelector: "[data-review-next]",
    cardSelector: ".review-card",
  });

  /* ---------- Doctor card flip (tap on touch devices) ---------- */
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  document.querySelectorAll(".doctor-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      if (canHover.matches) return;
      card.classList.toggle("is-flipped");
    });
  });
})();
