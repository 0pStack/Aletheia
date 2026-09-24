import { useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { allowsMotion } from '../../shared/motion/allowsMotion'
import { Button } from '../../shared/ui/Button/Button'
import { PatientInventory } from './inventory/PatientInventory'
import { usePatientSearch } from './usePatientSearch'
import styles from './PatientSearch.module.css'

export const PATIENT_SEARCH_ID = 'patients'

type Search = ReturnType<typeof usePatientSearch>

function SearchResults({ mode, query, search }: Search) {
  if (mode === 'idle') return null

  if (search.isPending) {
    return (
      <p className={styles.hint} role="status">
        {mode === 'all' ? 'Loading patients…' : 'Searching…'}
      </p>
    )
  }

  if (search.isError) {
    return (
      <div className={styles.state}>
        <p role="alert">{search.error.message}</p>
        <Button onClick={() => void search.refetch()} disabled={search.isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  if (search.data.length === 0) {
    return (
      <p className={styles.hint}>
        {mode === 'all' ? 'No patients yet.' : `No patients match “${query}”.`}
      </p>
    )
  }

  return <PatientInventory patients={search.data} />
}

// Only a settled answer to what is in the box: while the next query loads, the previous
// results stay on screen, and Enter must not open a patient from the search before.
function onlyMatch({ mode, query, search }: Search, input: string) {
  if (mode !== 'search' || query !== input.trim() || search.isPlaceholderData) return null
  return search.data?.length === 1 ? search.data[0] : null
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

// "/" to search, as on GitHub and in most search-first tools. Ignored while the user is typing
// somewhere else, and while the landing is out of reach behind an open journal.
function useSlashToSearch(field: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const origin = event.target
      if (
        origin instanceof HTMLElement &&
        (origin.isContentEditable || TYPING_TAGS.has(origin.tagName))
      ) {
        return
      }
      const input = field.current
      if (!input || input.closest('[inert]')) return
      event.preventDefault()
      input.focus({ preventScroll: true })
      input.scrollIntoView({ behavior: allowsMotion() ? 'smooth' : 'auto', block: 'center' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [field])
}

export function PatientSearch() {
  const [input, setInput] = useState('')
  const [showAll, setShowAll] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const search = usePatientSearch(input, showAll)
  useSlashToSearch(fieldRef)

  return (
    <section id={PATIENT_SEARCH_ID} className={styles.section} aria-labelledby="patients-heading">
      <h2 id="patients-heading" className={styles.heading}>
        Patients
      </h2>
      <form
        className={styles.form}
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const patient = onlyMatch(search, input)
          if (patient) void navigate(`/patients/${patient.id}`)
        }}
      >
        <label htmlFor="patient-search" className={styles.label}>
          Search patients
        </label>
        <input
          ref={fieldRef}
          id="patient-search"
          type="search"
          className={styles.input}
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            if (event.target.value.trim() !== '') setShowAll(false)
          }}
          placeholder="Name or personal number"
          autoComplete="off"
          spellCheck={false}
          // Arriving at /#patients (the landing's own action does) puts the cursor here.
          data-hash-focus
        />
        <div className={styles.row}>
          <p className={styles.hint}>Search by name or personal number.</p>
          <button
            type="button"
            className={styles.viewAll}
            onClick={() => {
              setInput('')
              setShowAll((current) => !current)
            }}
          >
            {showAll ? 'Hide all' : 'View all'}
          </button>
        </div>
      </form>
      <SearchResults {...search} />
    </section>
  )
}
