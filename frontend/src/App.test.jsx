import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import App from './App'

vi.mock('axios')

describe('App', () => {
  it('renders Vanni title and ping response', async () => {
    axios.get.mockResolvedValueOnce({
      data: { app: 'Vanni', status: 'ok' },
    })

    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vanni')

    await waitFor(() => {
      expect(screen.getByText(/"app": "Vanni"/)).toBeInTheDocument()
    })
  })
})
