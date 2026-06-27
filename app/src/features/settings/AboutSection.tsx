import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  ExternalLink,
  BookOpen,
  Lightbulb,
  Bug,
  Coffee,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { IS_RELEASE, APP_VERSION, APP_COMMIT } from "../../utils/version";
import { EXTERNAL_URLS } from "../../constants/app";
import CONTRIBUTORS from "../../config/contributors";
import THIRD_PARTY_LICENSES from "../../config/licenses";

export interface AboutSectionProps {
  openExternal: (url: string) => void;
}

export default function AboutSection({ openExternal }: AboutSectionProps) {
  const { t } = useTranslation();
  const [showAllLicenses, setShowAllLicenses] = useState(false);
  const githubRepoUrl = EXTERNAL_URLS.GITHUB_REPO ?? "";
  const websiteUrl = EXTERNAL_URLS.WEBSITE ?? "";
  const licenseUrl = EXTERNAL_URLS.LICENSE ?? "";
  const buyCoffeeUrl = EXTERNAL_URLS.BUY_ME_A_COFFEE ?? "";
  const releaseVersion = APP_VERSION ?? "";
  const commitHash = APP_COMMIT ?? "";
  const docsUrl = EXTERNAL_URLS.DOCS ?? `${websiteUrl}/docs`;

  return (
    <>
      <div className="about-header">
        <img
          src="/icon.png"
          alt="HoneyBear Folio"
          className="w-16 h-16 object-contain mb-3"
        />
        <h3 className="about-app-name">HoneyBear Folio</h3>
        <div className="about-version-badge">
          <span>{t("about.version")}:</span>
          {IS_RELEASE && APP_VERSION ? (
            <>
              <a
                href={`${githubRepoUrl}/releases/tag/v${releaseVersion}`}
                className="about-version-link"
                onClick={(e) => {
                  e.preventDefault();
                  openExternal(
                    `${githubRepoUrl}/releases/tag/v${releaseVersion}`,
                  );
                }}
              >
                v{releaseVersion}
              </a>
              {APP_COMMIT && (
                <>
                  <p>
                    (
                    <a
                      href={`${githubRepoUrl}/commit/${commitHash}`}
                      className="about-version-link"
                      style={{ fontFamily: "monospace" }}
                      onClick={(e) => {
                        e.preventDefault();
                        openExternal(`${githubRepoUrl}/commit/${commitHash}`);
                      }}
                    >
                      {commitHash.substring(0, 7)}
                    </a>
                    )
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <span>dev</span>
              {APP_COMMIT && (
                <p>
                  (
                  <a
                    href={`${githubRepoUrl}/commit/${commitHash}`}
                    className="about-version-link"
                    style={{ fontFamily: "monospace" }}
                    onClick={(e) => {
                      e.preventDefault();
                      openExternal(`${githubRepoUrl}/commit/${commitHash}`);
                    }}
                  >
                    {commitHash.substring(0, 7)}
                  </a>
                  )
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="about-section">
        <h4 className="about-section-title">{t("about.copyright")}</h4>
        <p className="about-section-content">© 2026 HoneyBearFolio</p>
      </div>

      <div className="about-section">
        <h4 className="about-section-title">{t("about.license")}</h4>
        <p className="about-license-text">{t("about.license_text")}</p>
        <a
          href={licenseUrl}
          className="about-link"
          onClick={(e) => {
            e.preventDefault();
            openExternal(licenseUrl);
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t("about.view_license")}
        </a>
      </div>

      <div className="about-section">
        <h4 className="about-section-title">{t("about.third_party")}</h4>
        {showAllLicenses && (
          <ul className="about-license-list">
            {THIRD_PARTY_LICENSES.map((l) => (
              <li key={l.name}>
                <a
                  href={l.url}
                  className="about-link"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternal(l.url);
                  }}
                >
                  {l.name}
                </a>
                <span className="about-license-meta">({l.license})</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2">
          <button
            onClick={() => {
              setShowAllLicenses(!showAllLicenses);
            }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            {showAllLicenses ? (
              <>
                <span>{t("about.third_party_hide")}</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>
                  {t("about.third_party_show", {
                    count: THIRD_PARTY_LICENSES.length,
                  })}
                </span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="about-divider" />

      <div className="about-section">
        <h4 className="about-section-title">{t("about.contributors")}</h4>
        {CONTRIBUTORS.map((c) => {
          const profileUrl = c.github || `https://github.com/${c.username}`;
          const avatarUrl = `https://avatars.githubusercontent.com/${c.username}?s=120&v=4`;
          return (
            <a
              key={c.username}
              href={profileUrl}
              className="about-contributor about-contributor-link"
              onClick={(e) => {
                e.preventDefault();
                openExternal(profileUrl);
              }}
            >
              <div className="about-contributor-avatar">
                <img src={avatarUrl} alt={`${c.username} avatar`} />
              </div>
              <div className="about-contributor-info">
                <span className="about-contributor-name">{c.username}</span>
                <span className="about-contributor-role">{t(c.roleKey)}</span>
              </div>
            </a>
          );
        })}
      </div>

      <div className="about-divider" />

      <div className="about-section">
        <div className="about-links">
          <a
            href={websiteUrl}
            className="about-link"
            onClick={(e) => {
              e.preventDefault();
              openExternal(websiteUrl);
            }}
          >
            <Globe className="w-3.5 h-3.5" />
            {t("about.website")}
          </a>
          <a
            href={githubRepoUrl}
            className="about-link"
            onClick={(e) => {
              e.preventDefault();
              openExternal(githubRepoUrl);
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {t("about.github")}
          </a>
          <a
            href={`${githubRepoUrl}/issues/new?template=feature_request.md`}
            className="about-link"
            onClick={(e) => {
              e.preventDefault();
              openExternal(
                `${githubRepoUrl}/issues/new?template=feature_request.md`,
              );
            }}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {t("about.features")}
          </a>
          <a
            href={`${githubRepoUrl}/issues/new?template=bug_report.md`}
            className="about-link"
            onClick={(e) => {
              e.preventDefault();
              openExternal(
                `${githubRepoUrl}/issues/new?template=bug_report.md`,
              );
            }}
          >
            <Bug className="w-3.5 h-3.5" />
            {t("about.issues")}
          </a>
          <a
            href={docsUrl}
            className="about-link"
            onClick={(e) => {
              e.preventDefault();
              openExternal(docsUrl);
            }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {t("about.docs")}
          </a>
          <a
            href={buyCoffeeUrl}
            className="about-link"
            onClick={(e) => {
              e.preventDefault();
              openExternal(buyCoffeeUrl);
            }}
          >
            <Coffee className="w-3.5 h-3.5" />
            {t("about.buy_me_a_coffee")}
          </a>
        </div>
      </div>
    </>
  );
}
