import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function NavBar() {
  const { signOut, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      console.log("🔐 Logging out user");
      await signOut();
      console.log("✅ Logout successful");
      router.push('/login');
    } catch (error) {
      console.error("❌ Logout failed:", error);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {isAuthenticated && (
        <>
          <Link 
            href="/agent" 
            className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded-md text-sm font-medium"
          >
            Tour Guide Assistant
          </Link>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium"
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
} 