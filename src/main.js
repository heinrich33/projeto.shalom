/**
 * PROJETO SHALOM — main.js
 * 10 Módulos independentes com Clean Code + Single Responsibility
 *
 * Módulos:
 * 1. ThemeManager      — dark/light + prefers-color-scheme + localStorage
 * 2. NavManager        — sticky navbar + hambúrguer + active link por scroll
 * 3. CarouselManager   — carrossel fullwidth com touch e autoplay
 * 4. TestimonialSlider — slider de depoimentos com autoplay
 * 5. ScrollAnimator    — IntersectionObserver para reveal de seções
 * 6. CounterAnimator   — contadores com easing ao entrar no viewport
 * 7. FormValidator     — validação inline + máscara tel + feedback + anti-duplo
 * 8. DonationManager   — seleção de valor + copiar PIX com feedback
 * 9. SmoothScroll      — scroll suave para todas as âncoras internas
 * 10. LazyLoader       — fallback para imagens em browsers antigos
 */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  /* ================================================================
     1. ThemeManager
     Prioridade: localStorage → prefers-color-scheme → padrão claro
  ================================================================ */
  const ThemeManager = (() => {
    const STORAGE_KEY = "shalom-theme";
    const root = document.documentElement;

    /**
     * Obtém o tema preferido do sistema operacional
     * @returns {'dark'|'light'}
     */
    function getSystemTheme() {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    /**
     * Aplica o tema ao documento
     * @param {'dark'|'light'} theme
     */
    function applyTheme(theme) {
      root.setAttribute("data-theme", theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (err) {
        console.error("[ThemeManager] Erro ao salvar tema:", err);
      }
    }

    /** Alterna entre dark e light */
    function toggle() {
      const current = root.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    }

    /** Inicializa o tema com a prioridade correta */
    function init() {
      let savedTheme = null;
      try {
        savedTheme = localStorage.getItem(STORAGE_KEY);
      } catch (err) {
        console.error("[ThemeManager] Erro ao ler localStorage:", err);
      }

      const theme = savedTheme || getSystemTheme() || "light";
      applyTheme(theme);

      const btn = document.getElementById("btnTheme");
      if (btn) btn.addEventListener("click", toggle);

      // Ouve mudanças no sistema (sem override do localStorage)
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          try {
            if (!localStorage.getItem(STORAGE_KEY)) {
              applyTheme(e.matches ? "dark" : "light");
            }
          } catch (_) {
            /* silencioso */
          }
        });
    }

    return { init };
  })();

  /* ================================================================
     2. NavManager
     Sticky com backdrop, hambúrguer animado, active link por scroll
  ================================================================ */
  const NavManager = (() => {
    const header = document.getElementById("header");
    const hamburger = document.getElementById("hamburger");
    const drawer = document.getElementById("navDrawer");
    const overlay = document.getElementById("navOverlay");
    const navLinks = document.querySelectorAll(
      '.nav-links a[href^="#"], .nav-drawer a[href^="#"]',
    );
    const sections = document.querySelectorAll("section[id]");

    const SCROLL_THRESHOLD = 50;

    /** Adiciona/remove classe scrolled conforme posição da página */
    function handleScroll() {
      header.classList.toggle("scrolled", window.scrollY > SCROLL_THRESHOLD);
      updateActiveLink();
    }

    /** Destaca o link da seção visível no viewport */
    function updateActiveLink() {
      const scrollMid = window.scrollY + window.innerHeight / 2;

      sections.forEach((section) => {
        const top = section.offsetTop;
        const bottom = top + section.offsetHeight;

        if (scrollMid >= top && scrollMid < bottom) {
          const id = section.getAttribute("id");
          navLinks.forEach((link) => {
            const isActive = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("active", isActive);
          });
        }
      });
    }

    /** Abre o drawer mobile */
    function openDrawer() {
      drawer.classList.add("open");
      overlay.classList.add("open");
      hamburger.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    /** Fecha o drawer mobile */
    function closeDrawer() {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      hamburger.classList.remove("active");
      document.body.style.overflow = "";
    }

    function init() {
      if (!header) return;

      window.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();

      if (hamburger)
        hamburger.addEventListener("click", () => {
          drawer.classList.contains("open") ? closeDrawer() : openDrawer();
        });

      if (overlay) overlay.addEventListener("click", closeDrawer);

      // Fecha ao clicar em link do drawer
      document.querySelectorAll(".nav-drawer a").forEach((link) => {
        link.addEventListener("click", closeDrawer);
      });

      // Fecha ao pressionar Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && drawer.classList.contains("open"))
          closeDrawer();
      });
    }

    return { init };
  })();

  /* ================================================================
     3. CarouselManager
     Autoplay, setas, dots, swipe touch, pausa no hover
  ================================================================ */
  const CarouselManager = (() => {
    const AUTOPLAY_MS = 7000;

    /**
     * Inicializa um carrossel dado seu seletor container
     * @param {string} wrapperId - ID do .carousel-wrapper
     */
    function initCarousel(wrapperId) {
      const wrapper = document.getElementById(wrapperId);
      if (!wrapper) return;

      const track = wrapper.querySelector(".carousel-track");
      const slides = wrapper.querySelectorAll(".carousel-slide");
      const dotsWrap = wrapper
        .closest(".carousel-outer")
        ?.querySelector(".carousel-dots");
      const prevBtn = wrapper.querySelector(".carousel-btn.prev");
      const nextBtn = wrapper.querySelector(".carousel-btn.next");

      if (!track || slides.length === 0) return;

      let current = 0;
      let timer = null;
      let touchStartX = 0;

      // Cria dots
      if (dotsWrap) {
        slides.forEach((_, i) => {
          const dot = document.createElement("button");
          dot.className = i === 0 ? "dot active" : "dot";
          dot.setAttribute("aria-label", `Ir para foto ${i + 1}`);
          dot.addEventListener("click", () => {
            goTo(i);
            resetAutoplay();
          });
          dotsWrap.appendChild(dot);
        });
      }

      /** Atualiza estado visual dos dots */
      function syncDots() {
        if (!dotsWrap) return;
        dotsWrap.querySelectorAll(".dot").forEach((d, i) => {
          d.classList.toggle("active", i === current);
        });
      }

      /**
       * Navega para um slide específico
       * @param {number} idx
       */
      function goTo(idx) {
        current = ((idx % slides.length) + slides.length) % slides.length;
        track.style.transform = `translateX(-${current * 100}%)`;
        syncDots();
      }

      /** Inicia autoplay */
      function startAutoplay() {
        stopAutoplay(); // sempre limpa antes de criar novo
        timer = setInterval(() => goTo(current + 1), AUTOPLAY_MS);
      }

      /** Para autoplay */
      function stopAutoplay() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      /** Reinicia autoplay após interação */
      function resetAutoplay() {
        stopAutoplay();
        startAutoplay();
      }

      if (prevBtn)
        prevBtn.addEventListener("click", () => {
          goTo(current - 1);
          resetAutoplay();
        });
      if (nextBtn)
        nextBtn.addEventListener("click", () => {
          goTo(current + 1);
          resetAutoplay();
        });

      // Pausa no hover (desktop)
      wrapper.addEventListener("mouseenter", stopAutoplay);
      wrapper.addEventListener("mouseleave", startAutoplay);

      // Swipe touch nativo
      wrapper.addEventListener(
        "touchstart",
        (e) => {
          touchStartX = e.changedTouches[0].clientX;
        },
        { passive: true },
      );

      wrapper.addEventListener(
        "touchend",
        (e) => {
          const diff = touchStartX - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 40) {
            diff > 0 ? goTo(current + 1) : goTo(current - 1);
            resetAutoplay();
          }
        },
        { passive: true },
      );

      // Navegação por teclado quando focado
      wrapper.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
          goTo(current - 1);
          resetAutoplay();
        }
        if (e.key === "ArrowRight") {
          goTo(current + 1);
          resetAutoplay();
        }
      });

      startAutoplay();
    }

    function init() {
      initCarousel("mainCarousel");
    }

    return { init };
  })();

  /* ================================================================
     4. TestimonialSlider
     Slider automático de depoimentos com pause no hover
  ================================================================ */
  const TestimonialSlider = (() => {
    const AUTOPLAY_MS = 5500;

    function init() {
      const track = document.querySelector(".depo-track");
      const slides = document.querySelectorAll(".depo-slide");
      const dotsWrap = document.querySelector(".depo-dots");

      if (!track || slides.length === 0) return;

      let current = 0;
      let timer = null;

      // Cria dots
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = i === 0 ? "dot active" : "dot";
        dot.setAttribute("aria-label", `Depoimento ${i + 1}`);
        dot.addEventListener("click", () => {
          goTo(i);
          resetAutoplay();
        });
        dotsWrap.appendChild(dot);
      });

      function syncDots() {
        dotsWrap.querySelectorAll(".dot").forEach((d, i) => {
          d.classList.toggle("active", i === current);
        });
      }

      function goTo(idx) {
        current = ((idx % slides.length) + slides.length) % slides.length;
        track.style.transform = `translateX(-${current * 100}%)`;
        syncDots();
      }

      function startAutoplay() {
        stopAutoplay(); // sempre limpa antes de criar novo
        timer = setInterval(() => goTo(current + 1), AUTOPLAY_MS);
      }
      function stopAutoplay() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
      function resetAutoplay() {
        stopAutoplay();
        startAutoplay();
      }

      const wrapper = track.closest(".depo-wrapper");
      if (wrapper) {
        wrapper.addEventListener("mouseenter", stopAutoplay);
        wrapper.addEventListener("mouseleave", startAutoplay);
      }

      startAutoplay();
    }

    return { init };
  })();

  /* ================================================================
     5. ScrollAnimator
     IntersectionObserver para revelar elementos .reveal ao entrar no viewport
  ================================================================ */
  const ScrollAnimator = (() => {
    const THRESHOLD = 0.12;
    const ROOT_MARGIN = "0px 0px -40px 0px";
    const STAGGER_MS = 100;

    function init() {
      const elements = document.querySelectorAll(
        ".reveal, .reveal-left, .reveal-right",
      );
      if (elements.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const siblings = Array.from(
              entry.target
                .closest(".reveal-group, section, .container")
                ?.querySelectorAll(".reveal, .reveal-left, .reveal-right") ||
                [],
            );
            const idx = Math.max(0, siblings.indexOf(entry.target));

            setTimeout(() => {
              entry.target.classList.add("visible");
            }, idx * STAGGER_MS);

            observer.unobserve(entry.target);
          });
        },
        { threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
      );

      elements.forEach((el) => observer.observe(el));
    }

    return { init };
  })();

  /* ================================================================
     6. CounterAnimator
     Anima números de 0 até o valor target com easing suave
  ================================================================ */
  const CounterAnimator = (() => {
    const DURATION_MS = 2200;

    /**
     * Easing easeOutCubic para suavizar a animação
     * @param {number} t - progresso 0..1
     * @returns {number}
     */
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Anima um único contador
     * @param {HTMLElement} el - elemento com data-target
     */
    function animateCounter(el) {
      const raw = el.getAttribute("data-target") || "0";
      const suffix = el.getAttribute("data-suffix") || "";
      const target = parseFloat(raw.replace(/[^0-9.]/g, ""));
      const isFloat = raw.includes(".");
      let start = null;

      function step(timestamp) {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / DURATION_MS, 1);
        const eased = easeOutCubic(progress);
        const current = isFloat
          ? (eased * target).toFixed(1)
          : Math.round(eased * target);

        el.textContent = Number(current).toLocaleString("pt-BR") + suffix;

        if (progress < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    }

    function init() {
      const counters = document.querySelectorAll("[data-counter]");
      if (counters.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.4 },
      );

      counters.forEach((el) => observer.observe(el));
    }

    return { init };
  })();

  /* ================================================================
     7. FormValidator
     Validação inline + máscara de telefone + feedback visual + anti-duplo
  ================================================================ */
  const FormValidator = (() => {
    /** Aplica máscara de telefone brasileiro */
    function maskPhone(input) {
      input.addEventListener("input", () => {
        let v = input.value.replace(/\D/g, "").slice(0, 11);
        if (v.length > 10) {
          v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
        } else if (v.length > 6) {
          v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
        } else if (v.length > 2) {
          v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
        } else {
          v = v.replace(/^(\d{0,2})$/, "($1");
        }
        input.value = v;
      });
    }

    /**
     * Valida um campo e exibe feedback
     * @param {HTMLInputElement} field
     * @returns {boolean}
     */
    function validateField(field) {
      const value = field.value.trim();
      const type = field.dataset.validate;
      const feedback = field
        .closest(".form-group")
        ?.querySelector(".form-feedback");
      let isValid = true;
      let message = "";

      if (type === "required" || !type) {
        isValid = value.length > 0;
        message = isValid ? "✓ Preenchido" : "Este campo é obrigatório.";
      }

      if (type === "email") {
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        message = isValid ? "✓ E-mail válido" : "Informe um e-mail válido.";
      }

      if (type === "phone") {
        isValid = value.replace(/\D/g, "").length >= 10;
        message = isValid
          ? "✓ Telefone válido"
          : "Informe um telefone válido (com DDD).";
      }

      field.classList.toggle("valid", isValid);
      field.classList.toggle("invalid", !isValid);

      if (feedback) {
        feedback.textContent = value.length > 0 ? message : "";
        feedback.className = `form-feedback ${value.length > 0 ? (isValid ? "valid" : "invalid") : ""}`;
      }

      return isValid;
    }

    function init() {
      const form = document.getElementById("formVoluntario");
      if (!form) return;

      const phoneInput = form.querySelector('[data-validate="phone"]');
      if (phoneInput) maskPhone(phoneInput);

      // Validação em tempo real ao sair do campo
      form.querySelectorAll("[data-validate]").forEach((field) => {
        field.addEventListener("blur", () => validateField(field));
        field.addEventListener("input", () => {
          if (field.classList.contains("invalid")) validateField(field);
        });
      });

      // Submit
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const fields = form.querySelectorAll("[data-validate]");
        let allValid = true;

        fields.forEach((field) => {
          if (!validateField(field)) allValid = false;
        });

        if (!allValid) return;

        const btn = form.querySelector('[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Enviando...";
        }

        setTimeout(() => {
          const nome = form.querySelector("#volNome").value.trim();
          const telefone = form.querySelector("#volTelefone").value.trim();
          const email = form.querySelector("#volEmail").value.trim();
          const area = form.querySelector("#volArea").value;
          const mensagem = form.querySelector("#volMensagem").value.trim();

          const texto = `Olá! Quero ser voluntário do Projeto Shalom! 🤝

*Nome:* ${nome}
*Telefone:* ${telefone}
*E-mail:* ${email}
*Área de interesse:* ${area}
${mensagem ? `*Mensagem:* ${mensagem}` : ""}`;

          const url = `https://wa.me/5531986718323?text=${encodeURIComponent(texto)}`;
          window.open(url, "_blank");

          form.style.display = "none";
          const success = document.getElementById("formSuccess");
          if (success) success.classList.add("show");
        }, 1200);
      }); // fecha form.addEventListener
    } // fecha init()

    return { init };
  })(); // fecha FormValidator

  /* ================================================================
     8. DonationManager
     Seleção de valor + input customizado + copiar chave PIX com feedback
  ================================================================ */
  const DonationManager = (() => {
    /** Mostra toast de confirmação */
    function showToast(message) {
      let toast = document.getElementById("toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.setAttribute("role", "alert");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3000);
    }

    function init() {
      // Seleção de valor de doação
      const valorBtns = document.querySelectorAll(".valor-btn");
      const inputValor = document.getElementById("inputValor");

      valorBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          valorBtns.forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");

          if (btn.dataset.value === "outro") {
            if (inputValor) {
              inputValor.classList.add("show");
              inputValor.focus();
            }
          } else {
            if (inputValor) inputValor.classList.remove("show");
          }
        });
      });

      // Copiar chave PIX
      const btnCopiar = document.getElementById("btnCopiarPix");
      const pixKey = document.getElementById("pixKey");

      if (btnCopiar && pixKey) {
        btnCopiar.addEventListener("click", async () => {
          const text = pixKey.textContent.trim();
          try {
            await navigator.clipboard.writeText(text);
            btnCopiar.textContent = "✓ Copiado!";
            btnCopiar.classList.add("copied");
            showToast("✓ Chave PIX copiada! Abra seu banco e cole para pagar.");
            setTimeout(() => {
              btnCopiar.textContent = "Copiar";
              btnCopiar.classList.remove("copied");
            }, 3000);
          } catch (err) {
            console.error("[DonationManager] Erro ao copiar:", err);
            // Fallback para browsers mais antigos
            const range = document.createRange();
            range.selectNode(pixKey);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand("copy");
            window.getSelection().removeAllRanges();
            btnCopiar.textContent = "✓ Copiado!";
            btnCopiar.classList.add("copied");
            showToast("✓ Chave PIX copiada com sucesso!");
            setTimeout(() => {
              btnCopiar.textContent = "Copiar";
              btnCopiar.classList.remove("copied");
            }, 3000);
          }
        });
      }
    }

    return { init };
  })();

  /* ================================================================
     9. SmoothScroll
     Scroll suave para todas as âncoras internas com offset do header
  ================================================================ */
  const SmoothScroll = (() => {
    function init() {
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", (e) => {
          const id = anchor.getAttribute("href");
          if (id === "#") return;

          const target = document.querySelector(id);
          if (!target) return;

          e.preventDefault();

          const header = document.getElementById("header");
          const offset = header ? header.offsetHeight + 16 : 80;
          const top =
            target.getBoundingClientRect().top + window.scrollY - offset;

          window.scrollTo({ top, behavior: "smooth" });
        });
      });
    }

    return { init };
  })();

  /* ================================================================
     10. LazyLoader
     Fallback para lazy loading em browsers que não suportam loading="lazy"
  ================================================================ */
  const LazyLoader = (() => {
    function init() {
      // Browsers modernos: atributo loading="lazy" é suficiente
      if ("loading" in HTMLImageElement.prototype) return;

      // Fallback via IntersectionObserver
      const lazyImages = document.querySelectorAll('img[loading="lazy"]');
      if (lazyImages.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute("data-src");
            }
            observer.unobserve(img);
          });
        },
        { rootMargin: "200px" },
      );

      lazyImages.forEach((img) => observer.observe(img));
    }

    return { init };
  })();

  /* ================================================================
     INICIALIZAÇÃO — ordem importa
  ================================================================ */
  ThemeManager.init();
  SmoothScroll.init();
  NavManager.init();
  ScrollAnimator.init();
  CounterAnimator.init();
  CarouselManager.init();
  TestimonialSlider.init();
  FormValidator.init();
  DonationManager.init();
  LazyLoader.init();
});
