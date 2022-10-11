using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;
using VidyanoWeb3.Service.Model;
using Vidyano.Service;

namespace VidyanoWeb3.Service
{
    public partial class VidyanoWeb3AuthenticatorService: AuthenticatorService
    {
        public override bool CheckUserCredentials(UserCredentials credentials)
        {
            return true; // base.CheckUserCredentials(credentials);
        }
    }
}