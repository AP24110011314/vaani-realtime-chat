import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router'
import { conversationApi } from '../api/conversationApi'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'
import ConnectionBanner from '../components/common/ConnectionBanner'

export default function AppShell() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)

  // Conversations list query without polling (realtime updates via WebSocket)
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list(false),
  })

  // Start direct chat mutation
  const startDirectMutation = useMutation({
    mutationFn: (targetUserId) => conversationApi.createDirect(targetUserId),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      navigate(`/app/c/${newConv.id}`)
    },
  })

  // Update conversation settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: ({ id, settings }) => conversationApi.updateSettings(id, settings),
    onSuccess: (updated) => {
      queryClient.setQueryData(['conversations'], (old = []) => {
        if (!Array.isArray(old)) return old
        if (updated.archived) {
          return old.filter((c) => c.id !== updated.id)
        }
        return old.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'archived'] })
      queryClient.setQueryData(['conversation', String(updated.id)], (old) =>
        old ? { ...old, ...updated } : updated
      )
    },
  })

  const handleStartDirectChat = async (targetUser) => {
    return startDirectMutation.mutateAsync(targetUser.id)
  }

  const handleUpdateSettings = async (id, settings) => {
    return updateSettingsMutation.mutateAsync({ id, settings })
  }

  const handleSelectConversation = (id) => {
    navigate(`/app/c/${id}`)
  }

  const handleBackToSidebar = () => {
    navigate('/app')
  }

  return (
    <div className="h-[100dvh] w-screen flex flex-col text-ink overflow-hidden font-sans p-1.5 sm:p-3 md:p-4 pb-[max(0.375rem,env(safe-area-inset-bottom))] gap-2 md:gap-3">
      <ConnectionBanner />
      <div className="flex-1 flex overflow-hidden gap-3 min-h-0">
        {/* Floating Sidebar Glass Card */}
        <div
          className={`w-full md:w-80 lg:w-[356px] flex-shrink-0 h-full rounded-[24px] md:rounded-[28px] glass overflow-hidden ${
            conversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <Sidebar
            conversations={conversations}
            activeId={conversationId}
            onSelectConversation={handleSelectConversation}
            onStartDirectChat={handleStartDirectChat}
            onUpdateSettings={handleUpdateSettings}
            isLoading={isLoading}
            isSearchModalOpen={isSearchModalOpen}
            onSearchModalOpenChange={setIsSearchModalOpen}
            isGroupModalOpen={isGroupModalOpen}
            onGroupModalOpenChange={setIsGroupModalOpen}
          />
        </div>

        {/* Main Chat Area (renders its own floating glass card + optional 3rd info glass card) */}
        <main
          className={`flex-1 h-full min-w-0 ${
            !conversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ChatWindow
            conversationId={conversationId}
            onBack={handleBackToSidebar}
            currentUserId={user?.id}
            onOpenNewChat={() => setIsSearchModalOpen(true)}
            onOpenNewGroup={() => setIsGroupModalOpen(true)}
          />
        </main>
      </div>
    </div>
  )
}
