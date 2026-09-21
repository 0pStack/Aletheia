import { useState } from 'react'
import { Button } from '../../shared/ui/Button/Button'
import { PatientInventory } from './inventory/PatientInventory'
import { usePatientSearch } from './usePatientSearch'
import styles from './PatientSearch.module.css'

export const PATIENT_SEARCH_ID = 'patients'

interface SearchResultsProps {
  input: string
  showAll: boolean
}

function SearchResults({ input, showAll }: SearchResultsProps) {
  const { mode, query, search } = usePatientSearch(input, showAll)

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

export function PatientSearch() {
  const [input, setInput] = useState('')
  const [showAll, setShowAll] = useState(false)

  return (
    <section id={PATIENT_SEARCH_ID} className={styles.section} aria-labelledby="patients-heading">
      <h2 id="patients-heading" className={styles.heading}>
        Patients
      </h2>
      <form className={styles.form} role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="patient-search" className={styles.label}>
          Search patients
        </label>
        <input
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
      <SearchResults input={input} showAll={showAll} />
    </section>
  )
}
