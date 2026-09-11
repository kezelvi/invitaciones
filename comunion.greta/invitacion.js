"use strict";

// El año no se especificó: la fecha se muestra sin inventar un año ni un contador.
// No se almacenan nombres ni confirmaciones; el mensaje solo se prepara para WhatsApp.
function buildConfirmationMessage(event, name, attending, count) {
  const greeting = "¡Hola! Soy " + name.trim() + ".";
  if (!attending) {
    return greeting + "\n\nEsta vez no podré acompañar a " + event.name +
      " en su primera comunión el " + event.date +
      ". Muchas gracias por la invitación. ¡Les deseo un día muy especial!";
  }
  const response = count === 1
    ? "Confirmo mi asistencia"
    : "Confirmamos la asistencia de " + count + " personas";
  return greeting + "\n\n" + response + " a la primera comunión de " +
    event.name + " el " + event.date + ", a las " + event.time +
    "\n\n¡Muchas gracias por la invitación!";
}

(() => {
  const form = document.getElementById("rsvp-form");
  const nameInput = document.getElementById("guest-name");
  const countInput = document.getElementById("guest-count");
  const countField = document.getElementById("guest-count-field");
  const status = document.getElementById("rsvp-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const event = {
    name: form.dataset.name,
    date: form.dataset.date,
    time: form.dataset.time
  };

  function isAttending() {
    return form.querySelector('input[name="attendance"]:checked').value === "yes";
  }
  function updateAttendance() {
    const attending = isAttending();
    countField.hidden = !attending;
    countInput.disabled = !attending;
    countInput.required = attending;
    countInput.setCustomValidity("");
    status.textContent = "";
  }
  form.querySelectorAll('input[name="attendance"]').forEach(input => {
    input.addEventListener("change", updateAttendance);
  });
  nameInput.addEventListener("input", () => {
    nameInput.setCustomValidity("");
    status.textContent = "";
  });
  countInput.addEventListener("input", () => {
    countInput.setCustomValidity("");
    status.textContent = "";
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    nameInput.value = nameInput.value.trim();
    nameInput.setCustomValidity(nameInput.value ? "" : "Escribe tu nombre o el de tu familia.");
    const attending = isAttending();
    const count = attending ? Number(countInput.value) : 0;
    countInput.setCustomValidity(attending && (!Number.isSafeInteger(count) || count < 1)
      ? "Escribe un número entero de personas, a partir de 1." : "");
    if (!form.reportValidity()) return;
    const message = buildConfirmationMessage(event, nameInput.value, attending, count);
    const url = "https://wa.me/?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
    status.textContent = "Elige el chat de la familia y envía el mensaje para completar tu confirmación. ";
    const retry = document.createElement("a");
    retry.href = url;
    retry.target = "_blank";
    retry.rel = "noopener noreferrer";
    retry.textContent = "Abrir WhatsApp";
    retry.style.textDecoration = "underline";
    status.append(retry);
  });
  updateAttendance();
  submitButton.disabled = false;

  const dialog = document.getElementById("photo-dialog");
  const lightboxImage = document.getElementById("lightbox-image");
  const photoCounter = document.getElementById("photo-counter");
  const photoError = document.getElementById("photo-error");
  const originalLink = document.getElementById("original-photo");
  const photoLinks = Array.from(document.querySelectorAll("a[data-photo]"))
    .sort((a, b) => Number(a.dataset.photo) - Number(b.dataset.photo));
  const photos = photoLinks.map(link => ({
    src: link.getAttribute("href"),
    alt: link.querySelector("img").alt
  }));
  let index = 0;
  let opener = null;

  function showPhoto(nextIndex) {
    index = (nextIndex + photos.length) % photos.length;
    photoError.hidden = true;
    lightboxImage.hidden = false;
    lightboxImage.classList.add("is-loading");
    lightboxImage.alt = photos[index].alt;
    originalLink.href = photos[index].src;
    lightboxImage.src = photos[index].src;
    photoCounter.textContent = String(index + 1).padStart(2, "0") + " / " + String(photos.length).padStart(2, "0");
  }
  lightboxImage.addEventListener("load", () => lightboxImage.classList.remove("is-loading"));
  lightboxImage.addEventListener("error", () => {
    lightboxImage.hidden = true;
    lightboxImage.classList.remove("is-loading");
    photoError.hidden = false;
  });
  function closePhoto() {
    if (dialog.open) dialog.close();
  }
  if (typeof dialog.showModal === "function") {
    photoLinks.forEach((link, photoIndex) => {
      link.addEventListener("click", e => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        opener = link;
        showPhoto(photoIndex);
        dialog.showModal();
        document.body.classList.add("modal-open");
        document.getElementById("close-photo").focus();
      });
    });
    document.getElementById("close-photo").addEventListener("click", closePhoto);
    document.getElementById("prev-photo").addEventListener("click", () => showPhoto(index - 1));
    document.getElementById("next-photo").addEventListener("click", () => showPhoto(index + 1));
    dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      if (opener) opener.focus({ preventScroll: true });
    });
    dialog.addEventListener("click", e => {
      if (e.target === dialog) closePhoto();
    });
    dialog.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") { e.preventDefault(); showPhoto(index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); showPhoto(index + 1); }
    });
    let touchStart = null;
    dialog.addEventListener("touchstart", e => {
      touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    dialog.addEventListener("touchend", e => {
      if (!touchStart || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        showPhoto(index + (dx < 0 ? 1 : -1));
      }
      touchStart = null;
    }, { passive: true });
  }

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("is-pending");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06 });
    document.querySelectorAll(".reveal").forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight * 0.95) {
        element.classList.add("is-pending");
        observer.observe(element);
      }
    });
  }
})();
