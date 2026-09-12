import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChangeEvent, ReactNode } from 'react'

import { importProfile, parseProfileExport, ProfileImportError } from '@/db/transfer.ts'
import { useI18n } from '@/i18n/context.ts'
import { LOCALES } from '@/i18n/messages.ts'
import type { Locale } from '@/i18n/messages.ts'
import { useSettings } from '@/store/settings.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'

export function Settings(): ReactNode {
  const { t } = useI18n()
  const settings = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  function handleImport(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file === undefined) return
    void file
      .text()
      .then((raw) => importProfile(parseProfileExport(raw)))
      .then((appliance) => {
        setMessage(t('settings.importSuccess', { name: appliance.name }))
      })
      .catch((error: unknown) => {
        const reason = error instanceof ProfileImportError ? error.message : String(error)
        setMessage(t('settings.importError', { reason }))
      })
      .finally(() => {
        event.target.value = ''
      })
  }

  return (
    <AppShell title={t('settings.title')} back="/">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium">{t('settings.language')}</h2>
          <div className="flex gap-2">
            {LOCALES.map((locale: Locale) => (
              <Button
                key={locale}
                variant={settings.locale === locale ? 'primary' : 'secondary'}
                onClick={() => {
                  settings.setLocale(locale)
                }}
              >
                {locale === 'es' ? t('settings.languageEs') : t('settings.languageEn')}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <Toggle
            label={t('settings.deeperAnalysis')}
            help={t('settings.deeperAnalysisHelp')}
            checked={settings.deeperAnalysis}
            onChange={settings.setDeeperAnalysis}
          />
          <Toggle
            label={t('settings.keepClips')}
            help={t('settings.keepClipsHelp')}
            checked={settings.keepClips}
            onChange={settings.setKeepClips}
          />
          <p className="tabular text-sm text-ink-faint">
            {t('settings.retention', { days: settings.retentionDays })}
          </p>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-medium">{t('settings.importProfile')}</h2>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={handleImport}
          />
          <Button
            variant="secondary"
            onClick={() => {
              fileInput.current?.click()
            }}
          >
            {t('settings.importProfile')}
          </Button>
          {message !== null && (
            <p role="status" className="text-sm text-ink-soft">
              {message}
            </p>
          )}
        </Card>

        <Link to="/help">
          <Button variant="secondary" size="lg">
            {t('nav.help')}
          </Button>
        </Link>

        <Link to="/privacy">
          <Button variant="ghost" size="lg">
            {t('nav.privacy')}
          </Button>
        </Link>
      </div>
    </AppShell>
  )
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  readonly label: string
  readonly help: string
  readonly checked: boolean
  readonly onChange: (value: boolean) => void
}): ReactNode {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-ink-faint">{help}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked)
        }}
        className="mt-1 size-6 shrink-0 accent-[var(--color-accent)]"
      />
    </label>
  )
}
