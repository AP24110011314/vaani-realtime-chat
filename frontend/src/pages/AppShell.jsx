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
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <ConnectionBanner />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - visible on desktop, or mobile when no conversation is selected */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-slate-800 ${
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
          />
        </div>

        {/* Main Chat Area - visible on desktop, or mobile when conversation is selected */}
        <main
          className={`flex-1 h-full min-w-0 ${
            !conversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ChatWindow
            conversationId={conversationId}
            onBack={handleBackToSidebar}
            currentUserId={user?.id}
          />
        </main>
      </div>
    </div>
  )
}
