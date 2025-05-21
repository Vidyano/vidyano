using System;
using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions
{
    public class Test : CustomAction<DevContext>
    {
        /// <inheritdoc />
        public Test(DevContext context) : base(context)
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