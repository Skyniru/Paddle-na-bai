"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Heart, Mail, X } from "lucide-react";
import { version } from "../../../package.json";

const developerEmail = "neil.relador04@gmail.com";
const gcashNumber = "09274901442";
const feedbackLink = `mailto:${developerEmail}?subject=${encodeURIComponent("PaddleBai — Feedback & Suggestions")}&body=${encodeURIComponent("Hi Neil,\n\nI'd like to share some feedback about PaddleBai:\n\n[Write your ideas or suggestions here.]\n\nThank you!")}`;

export default function DeveloperAbout() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [navigationHeight, setNavigationHeight] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyTarget, setCopyTarget] = useState("");

  async function copy(value: string, label: string) {
    setCopyMessage("");
    setCopyTarget(label);
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(
        `Could not copy automatically. Select and copy the ${label.toLowerCase()} above.`,
      );
    }
  }

  useEffect(() => {
    const navigation = document.querySelector(".bottom-nav");
    if (!navigation) return;
    const measure = () =>
      setNavigationHeight(navigation.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, []);

  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <div
        className="developer-button-dock"
        style={{ height: navigationHeight ? `${navigationHeight}px` : "72px" }}
      >
        <button
          ref={trigger}
          type="button"
          className="developer-about-button"
          aria-label="About the Developer"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="developer-about-dialog"
          title="About the Developer"
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <span aria-hidden="true">N</span>
        </button>
      </div>
      <dialog
        ref={dialog}
        id="developer-about-dialog"
        className="developer-about-dialog"
        aria-labelledby="developer-about-title"
        onClose={() => {
          setOpen(false);
          setCopyMessage("");
          trigger.current?.focus({ preventScroll: true });
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }}
      >
        <div className="developer-about-heading">
          <h2 id="developer-about-title">Meet the Developer</h2>
          <button
            type="button"
            className="developer-about-close"
            aria-label="Close About the Developer"
            onClick={close}
            autoFocus
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="developer-about-body">
          <h3>Neil Iwelador</h3>
          <p className="developer-about-role">
            Solo Developer &amp; IT Enthusiast
          </p>
          <p className="developer-about-bio">
            Hi! I&apos;m Neil, an aspiring developer with a passion for
            technology, sports, and creating useful applications. I&apos;m still
            learning and improving my development skills, and PaddleBai is one
            of the projects I&apos;m building to make managing open-play games
            easier and more enjoyable for everyone.
          </p>
          <section
            className="developer-about-section"
            aria-labelledby="developer-feedback-title"
          >
            <h4 id="developer-feedback-title">
              <Mail size={16} aria-hidden="true" /> Have Ideas or Suggestions?
            </h4>
            <p>
              Enjoying PaddleBai? I&apos;d love to hear your feedback! If you
              have ideas, suggestions, or notice something that could be
              improved, feel free to reach out. I&apos;m a solo developer
              who&apos;s still learning, and every suggestion helps me make
              PaddleBai better.
            </p>
            <a
              className="developer-about-action developer-about-email"
              href={feedbackLink}
            >
              <Mail size={16} aria-hidden="true" /> Email the Developer
            </a>
            <div className="developer-about-copy-row">
              <span className="developer-about-copy-value">
                {developerEmail}
              </span>
              <button
                type="button"
                className="developer-about-action"
                aria-label="Copy email address"
                onClick={() => copy(developerEmail, "Email address")}
              >
                <Copy size={16} aria-hidden="true" /> Copy
              </button>
            </div>
            <p
              className="developer-about-copy-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {copyTarget === "Email address" ? copyMessage : ""}
            </p>
          </section>
          <section
            className="developer-about-section"
            aria-labelledby="developer-support-title"
          >
            <h4 id="developer-support-title">
              <Heart size={16} aria-hidden="true" /> Support the Developer
            </h4>
            <p>
              PaddleBai is a free project built with passion and continuous
              learning. If you enjoy using the app and would like to support its
              development, you can send an optional contribution through GCash.
              Your support is always appreciated, but never required.
            </p>
            <p className="developer-about-copy-value">
              GCash Number: <strong>{gcashNumber}</strong>
            </p>
            <button
              type="button"
              className="developer-about-action"
              onClick={() => copy(gcashNumber, "GCash number")}
            >
              <Copy size={16} aria-hidden="true" /> Copy GCash Number
            </button>
            <p
              className="developer-about-copy-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {copyTarget === "GCash number" ? copyMessage : ""}
            </p>
          </section>

          <footer className="developer-about-footer">
            <p>Made with passion, patience, and lots of learning.</p>
            <small>© 2026 PaddleBai</small>
            <p className="developer-about-version">Version {version}</p>
          </footer>
        </div>
      </dialog>
    </>
  );
}
