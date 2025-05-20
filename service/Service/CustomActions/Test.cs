using System;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.CustomActions
{
    public class Test : CustomAction<VidyanoWeb3Context>
    {
        /// <inheritdoc />
        public Test(VidyanoWeb3Context context) : base(context)
        {
        }

        /// <inheritdoc />
        public override PersistentObject Execute(CustomActionArgs e)
        {
            e.Parent.AddNotification($"{e.Parameters["AttributeName"]}: {DateTime.Now}");

            //var attr = e.Parent.GetAttribute(e.Parameters["AttributeName"]);
            //attr.Actions = attr.Actions?.Length > 0 ? Array.Empty<string>() : new[] { "Test" };

            return e.Parent;
        }
    }
}