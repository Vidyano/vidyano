using Vidyano.Service.Repository;
using Dev.Service.Model;
using Vidyano.Service;

namespace Dev.Service
{
    public partial class DevAuthenticatorService: AuthenticatorService
    {
        public override bool CheckUserCredentials(UserCredentials credentials)
        {
            if (credentials.UserName?.Equals("admin", StringComparison.OrdinalIgnoreCase) == true)
            {
                // Simulate successful authentication for the admin user.
                return true;
            }

            return base.CheckUserCredentials(credentials);
        }
    }
}