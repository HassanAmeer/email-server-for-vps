import dns from "dns";
dns.resolveMx("gmail.com", (err, addresses) => {
    console.log(addresses);
});
