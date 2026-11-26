import { useContext } from 'react'
import { CallContext } from '../context/CallContext'

export function useCall() {
  return useContext(CallContext)
}
