import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

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
    <div>
      {isAuthenticated && (
        <button
          onClick={handleLogout}
          className="text-gray-600 hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium"
        >
          Logout
        </button>
      )}
    </div>
  );
} 